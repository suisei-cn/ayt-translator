const NedbDatastore: any = require('nedb');

interface UpdateOptions {
  multi?: boolean;
  upsert?: boolean;
  returnUpdatedDocs?: boolean;
}

interface UpdateResults<T> {
  numberOfUpdate: number;
  affectedDocuments: T;
  upsert: boolean;
}

class WrappedDatastore {
  nedb: any;

  constructor(nedb: any) {
    this.nedb = nedb;
  }

  update<T>(query: any, updateQuery: any, options: UpdateOptions): Promise<UpdateResults<T>> {
    return new Promise<UpdateResults<T>>((resolve, reject) => {
      this.nedb.update(query, updateQuery, options, (err: any, numberOfUpdate: number, affectedDocuments: T, upsert: boolean) => {
        if (err) reject(err); else resolve({ numberOfUpdate, affectedDocuments, upsert });
      });
    });
  }
}

// Hack around TypeScript's typing system
interface WrappedDatastore {
  insert<T>(newDoc: T): Promise<T>;
  find<T>(query: any, projection: any): Promise<T[]>;
  find<T>(query: any): Promise<T[]>;
  findOne<T>(query: any, projection: T): Promise<T>;
  findOne<T>(query: any): Promise<T>;
  count(query: any): Promise<number>;
  remove(query: any, options: { multi?: boolean }): Promise<number>;
  ensureIndex(options: { fieldName: string, unique?: boolean, sparse?: boolean, expireAfterSeconds?: number }): Promise<void>;
  removeIndex(fieldName: string): Promise<void>;
}

for (let name of ['insert', 'find', 'findOne', 'count', 'remove', 'ensureIndex', 'removeIndex']) {
  (WrappedDatastore.prototype as any)[name] = function (...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      this.nedb[name](...args, (err: any, val: any) => {
        if (err) reject(err); else resolve(val);
      });
    });
  }
}

export function getCollection(coll: string) {
  return new WrappedDatastore(new NedbDatastore({ filename: coll + '.db', autoload: true }));
}
