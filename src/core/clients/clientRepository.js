import { listAllRows } from "../opsApi";
import { mergeClients } from "./clientMapper.mjs";
export const clientRepository = {
  async list() {
    const [operational, master] = await Promise.allSettled([listAllRows("lg_clients", "name.asc"), listAllRows("clients", "name.asc")]);
    if (operational.status === "rejected" && master.status === "rejected") throw new Error(`Falha nas fontes de clientes: ${operational.reason?.message}; ${master.reason?.message}`);
    return mergeClients(operational.status === "fulfilled" ? operational.value : [], master.status === "fulfilled" ? master.value.filter(row => !row.deleted_at) : []);
  }
};
