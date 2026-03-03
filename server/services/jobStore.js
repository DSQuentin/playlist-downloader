import { randomUUID } from "node:crypto";

export class JobStore {
  constructor() {
    this.jobs = new Map();
  }

  create(url, ip = null) {
    const id = randomUUID();
    const job = {
      id,
      url,
      ip,
      status: "pending",
      playlistTitle: null,
      tracks: [],
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id) {
    return this.jobs.get(id);
  }

  update(id, fields) {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, fields);
  }

  delete(id) {
    this.jobs.delete(id);
  }

  countByIp(ip) {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.ip === ip && job.status !== "complete" && job.status !== "error") {
        count++;
      }
    }
    return count;
  }
}
