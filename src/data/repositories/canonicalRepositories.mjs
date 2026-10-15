export class CanonicalRepository {
  constructor(adapter, table) { this.adapter=adapter; this.table=table; }
  list(filters={}) { return this.adapter.list(this.table,filters); }
  get(id) { return this.adapter.get(this.table,id); }
  create(record) { return this.adapter.create(this.table,record); }
  update(id,record) { return this.adapter.update(this.table,id,record); }
}
export class ClientRepository extends CanonicalRepository { constructor(adapter){super(adapter,"clients")} }
export class PropertyRepository extends CanonicalRepository { constructor(adapter){super(adapter,"properties")} }
export class RegistryRepository extends CanonicalRepository { constructor(adapter){super(adapter,"registry_records")} }
export class CartorialProjectRepository extends CanonicalRepository { constructor(adapter){super(adapter,"cartorial_processes")} }
