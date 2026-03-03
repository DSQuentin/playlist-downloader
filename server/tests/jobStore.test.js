import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JobStore } from "../services/jobStore.js";

describe("JobStore", () => {
  let store;

  beforeEach(() => {
    store = new JobStore();
  });

  it("creates a job and returns its id", () => {
    const job = store.create("https://youtube.com/playlist?list=PLtest");
    assert.ok(job.id);
    assert.equal(job.url, "https://youtube.com/playlist?list=PLtest");
    assert.equal(job.status, "pending");
  });

  it("retrieves a job by id", () => {
    const { id } = store.create("https://youtube.com/playlist?list=PLtest");
    const job = store.get(id);
    assert.equal(job.id, id);
  });

  it("returns undefined for unknown id", () => {
    assert.equal(store.get("nonexistent"), undefined);
  });

  it("updates job fields", () => {
    const { id } = store.create("https://youtube.com/playlist?list=PLtest");
    store.update(id, { status: "downloading", playlistTitle: "My Playlist" });
    const job = store.get(id);
    assert.equal(job.status, "downloading");
    assert.equal(job.playlistTitle, "My Playlist");
  });

  it("deletes a job", () => {
    const { id } = store.create("https://youtube.com/playlist?list=PLtest");
    store.delete(id);
    assert.equal(store.get(id), undefined);
  });

  it("counts active jobs for a given IP", () => {
    store.create("https://youtube.com/playlist?list=PL1", "1.2.3.4");
    store.create("https://youtube.com/playlist?list=PL2", "1.2.3.4");
    store.create("https://youtube.com/playlist?list=PL3", "5.6.7.8");
    assert.equal(store.countByIp("1.2.3.4"), 2);
    assert.equal(store.countByIp("5.6.7.8"), 1);
  });
});
