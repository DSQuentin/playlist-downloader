import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidPlaylistUrl } from "../middleware/validateUrl.js";

describe("isValidPlaylistUrl", () => {
  it("accepts a standard YouTube playlist URL", () => {
    assert.equal(
      isValidPlaylistUrl("https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
      true
    );
  });

  it("accepts a youtube.com/watch URL with a list parameter", () => {
    assert.equal(
      isValidPlaylistUrl("https://www.youtube.com/watch?v=abc123&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
      true
    );
  });

  it("accepts youtu.be short URL with list parameter", () => {
    assert.equal(
      isValidPlaylistUrl("https://youtu.be/abc123?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
      true
    );
  });

  it("rejects a single video URL without list parameter", () => {
    assert.equal(
      isValidPlaylistUrl("https://www.youtube.com/watch?v=abc123"),
      false
    );
  });

  it("rejects a non-YouTube URL", () => {
    assert.equal(isValidPlaylistUrl("https://www.google.com"), false);
  });

  it("rejects empty string", () => {
    assert.equal(isValidPlaylistUrl(""), false);
  });

  it("rejects non-URL strings", () => {
    assert.equal(isValidPlaylistUrl("not a url at all"), false);
  });
});
