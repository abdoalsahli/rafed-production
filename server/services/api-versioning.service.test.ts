import { describe, it, expect } from "vitest";
import {
  ApiVersioningService,
  ApiVersion,
} from "./api-versioning.service";

describe("ApiVersioningService", () => {
  describe("negotiateVersion", () => {
    it("should negotiate v2 from Accept-Version header", () => {
      const result = ApiVersioningService.negotiateVersion("v2");

      expect(result.requestedVersion).toBe(ApiVersion.V2);
      expect(result.resolvedVersion).toBe(ApiVersion.V2);
      expect(result.isDeprecated).toBe(false);
    });

    it("should negotiate v1 from Accept-Version header", () => {
      const result = ApiVersioningService.negotiateVersion("v1");

      expect(result.requestedVersion).toBe(ApiVersion.V1);
      expect(result.resolvedVersion).toBe(ApiVersion.V1);
      expect(result.isDeprecated).toBe(true);
      expect(result.deprecationWarning).toBeDefined();
    });

    it("should negotiate version from URL path", () => {
      const result = ApiVersioningService.negotiateVersion(
        undefined,
        "/api/v2/purchases"
      );

      expect(result.resolvedVersion).toBe(ApiVersion.V2);
    });

    it("should default to latest stable version", () => {
      const result = ApiVersioningService.negotiateVersion();

      expect(result.resolvedVersion).toBe(ApiVersion.V2);
      expect(result.requestedVersion).toBeNull();
    });

    it("should handle case-insensitive header", () => {
      const result = ApiVersioningService.negotiateVersion("V2");

      expect(result.resolvedVersion).toBe(ApiVersion.V2);
    });

    it("should ignore invalid version in header", () => {
      const result = ApiVersioningService.negotiateVersion("v3");

      expect(result.resolvedVersion).toBe(ApiVersion.V2);
    });
  });

  describe("getVersionMetadata", () => {
    it("should return v1 metadata", () => {
      const metadata = ApiVersioningService.getVersionMetadata(ApiVersion.V1);

      expect(metadata.version).toBe(ApiVersion.V1);
      expect(metadata.status).toBe("deprecated");
      expect(metadata.features).toContain("Numeric product IDs");
    });

    it("should return v2 metadata", () => {
      const metadata = ApiVersioningService.getVersionMetadata(ApiVersion.V2);

      expect(metadata.version).toBe(ApiVersion.V2);
      expect(metadata.status).toBe("stable");
      expect(metadata.features).toContain("Product codes (code-first API)");
    });
  });

  describe("isVersionSupported", () => {
    it("should return true for supported versions", () => {
      expect(ApiVersioningService.isVersionSupported(ApiVersion.V1)).toBe(true);
      expect(ApiVersioningService.isVersionSupported(ApiVersion.V2)).toBe(true);
    });
  });

  describe("getLatestStableVersion", () => {
    it("should return v2 as latest stable", () => {
      const latest = ApiVersioningService.getLatestStableVersion();

      expect(latest).toBe(ApiVersion.V2);
    });
  });

  describe("isVersionDeprecated", () => {
    it("should return true for deprecated v1", () => {
      expect(ApiVersioningService.isVersionDeprecated(ApiVersion.V1)).toBe(
        true
      );
    });

    it("should return false for stable v2", () => {
      expect(ApiVersioningService.isVersionDeprecated(ApiVersion.V2)).toBe(
        false
      );
    });
  });

  describe("getDeprecationInfo", () => {
    it("should return deprecation info for v1", () => {
      const info = ApiVersioningService.getDeprecationInfo(ApiVersion.V1);

      expect(info.isDeprecated).toBe(true);
      expect(info.deprecationDate).toBeDefined();
      expect(info.migrationGuide).toBeDefined();
    });

    it("should return no deprecation for v2", () => {
      const info = ApiVersioningService.getDeprecationInfo(ApiVersion.V2);

      expect(info.isDeprecated).toBe(false);
      expect(info.deprecationDate).toBeUndefined();
    });
  });

  describe("getBreakingChanges", () => {
    it("should return empty breaking changes for v1", () => {
      const changes = ApiVersioningService.getBreakingChanges(ApiVersion.V1);

      expect(changes).toEqual([]);
    });

    it("should return breaking changes for v2", () => {
      const changes = ApiVersioningService.getBreakingChanges(ApiVersion.V2);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0]).toContain("Product lookup");
    });
  });

  describe("formatVersionHeader", () => {
    it("should format v2 header without deprecation", () => {
      const header = ApiVersioningService.formatVersionHeader(ApiVersion.V2);

      expect(header).toBe("v2");
    });

    it("should format v1 header with deprecation", () => {
      const header = ApiVersioningService.formatVersionHeader(ApiVersion.V1);

      expect(header).toContain("v1");
      expect(header).toContain("deprecated=true");
      expect(header).toContain("sunset=");
    });
  });

  describe("getVersionConfig", () => {
    it("should return v1 config with legacy settings", () => {
      const config = ApiVersioningService.getVersionConfig(ApiVersion.V1);

      expect(config.productLookupBy).toBe("numeric_id");
      expect(config.responseFormat).toBe("legacy");
      expect(config.rateLimitPerMinute).toBeNull();
      expect(config.correlationIdRequired).toBe(false);
    });

    it("should return v2 config with modern settings", () => {
      const config = ApiVersioningService.getVersionConfig(ApiVersion.V2);

      expect(config.productLookupBy).toContain("numeric_id");
      expect(config.productLookupBy).toContain("product_code");
      expect(config.responseFormat).toBe("unified");
      expect(config.rateLimitPerMinute).toBe(60);
      expect(config.correlationIdRequired).toBe(true);
      expect(config.deadLetterQueueEnabled).toBe(true);
    });
  });

  describe("getAllVersions", () => {
    it("should return all versions", () => {
      const versions = ApiVersioningService.getAllVersions();

      expect(Object.keys(versions)).toContain("v1");
      expect(Object.keys(versions)).toContain("v2");
    });
  });

  describe("version negotiation priority", () => {
    it("should prioritize header over URL path", () => {
      const result = ApiVersioningService.negotiateVersion(
        "v2",
        "/api/v1/purchases"
      );

      expect(result.resolvedVersion).toBe(ApiVersion.V2);
    });

    it("should use URL path when header is absent", () => {
      const result = ApiVersioningService.negotiateVersion(
        undefined,
        "/api/v1/purchases"
      );

      expect(result.resolvedVersion).toBe(ApiVersion.V1);
    });
  });
});
