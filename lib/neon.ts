'use client';

type Filter = { column: string; operator: 'eq' | 'in'; value: any };

class QueryBuilder<T = any[]> implements PromiseLike<{ data: T | null; error: any }> {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectCols: string = '*';
  private filters: Filter[] = [];
  private orderConfig?: { column: string; ascending?: boolean };
  private limitCount?: number;
  private payloadData?: any;
  private conflictCol?: string;
  private expectSingle: boolean = false;
  private expectMaybeSingle: boolean = false;

  constructor(table: string) {
    this.tableName = table;
  }

  select(cols: string = '*'): QueryBuilder<any[]> {
    if (!['insert', 'update', 'delete', 'upsert'].includes(this.action)) {
      this.action = 'select';
    }
    this.selectCols = cols;
    return this as any;
  }

  insert(data: any): QueryBuilder<any> {
    this.action = 'insert';
    this.payloadData = data;
    return this as any;
  }

  update(data: any): QueryBuilder<any[]> {
    this.action = 'update';
    this.payloadData = data;
    return this as any;
  }

  delete(): QueryBuilder<any[]> {
    this.action = 'delete';
    return this as any;
  }

  upsert(data: any, options?: { onConflict?: string }): QueryBuilder<any> {
    this.action = 'upsert';
    this.payloadData = data;
    this.conflictCol = options?.onConflict || 'id';
    return this as any;
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderConfig = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): QueryBuilder<any> {
    this.expectSingle = true;
    return this as any;
  }

  maybeSingle(): QueryBuilder<any> {
    this.expectMaybeSingle = true;
    return this as any;
  }

  async execute(): Promise<{ data: T | null; error: any }> {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: this.action,
          table: this.tableName,
          select: this.selectCols,
          filters: this.filters,
          order: this.orderConfig,
          limit: this.limitCount,
          data: this.payloadData,
          conflict: this.conflictCol,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errorMsg =
          typeof json.error === 'string'
            ? json.error
            : json.error?.message || `Request failed with status ${res.status}`;
        return { data: null, error: new Error(errorMsg) };
      }

      let data = json.data;
      if (this.expectSingle) {
        if (Array.isArray(data)) {
          if (data.length === 0) {
            return { data: null, error: new Error('Record not found') };
          }
          data = data[0];
        } else if (!data) {
          return { data: null, error: new Error('Record not found') };
        }
      } else if (this.expectMaybeSingle) {
        if (Array.isArray(data)) {
          data = data.length > 0 ? data[0] : null;
        }
      }

      return { data, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  then<TResult1 = { data: T | null; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Global auth listeners
type AuthListener = (event: string, session: any) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthChange(event: string, session: any) {
  authListeners.forEach((cb) => cb(event, session));
}

export const neonClient = {
  from: (table: string) => new QueryBuilder(table),

  auth: {
    signUp: async ({
      email,
      password,
      full_name,
      role = 'student',
      phone = '',
    }: {
      email: string;
      password: string;
      full_name?: string;
      role?: 'teacher' | 'student';
      phone?: string;
    }) => {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            full_name: full_name || email.split('@')[0],
            role,
            phone,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          return { data: { user: null, session: null }, error: new Error(json.error || 'Sign up failed') };
        }
        notifyAuthChange('SIGNED_IN', { user: json.user });
        return { data: { user: json.user, session: { user: json.user }, profile: json.profile }, error: null };
      } catch (err) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok) {
          return { data: { user: null, session: null }, error: new Error(json.error || 'Sign in failed') };
        }
        notifyAuthChange('SIGNED_IN', { user: json.user });
        return { data: { user: json.user, session: { user: json.user } }, error: null };
      } catch (err) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signOut: async () => {
      try {
        await fetch('/api/auth/signout', { method: 'POST' });
        notifyAuthChange('SIGNED_OUT', null);
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    },

    getSession: async () => {
      try {
        const res = await fetch('/api/auth/session');
        const json = await res.json();
        if (json.user) {
          return { data: { session: { user: json.user } }, error: null };
        }
        return { data: { session: null }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },

    onAuthStateChange: (callback: AuthListener) => {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  storage: {
    from: (_bucket: string) => ({
      upload: async (filename: string, file: File, _options?: any) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('filename', filename);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          const json = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(json.error || 'Upload failed') };
          }
          return { data: { path: json.publicUrl }, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },

      getPublicUrl: (filename: string) => {
        // If already a URL or path, use it; otherwise prepend /uploads/
        const publicUrl = filename.startsWith('/') || filename.startsWith('http')
          ? filename
          : `/uploads/${filename}`;
        return { data: { publicUrl } };
      },
    }),
  },
};

// Aliases for clean adoption
export const neon = neonClient;
export const db = neonClient;
