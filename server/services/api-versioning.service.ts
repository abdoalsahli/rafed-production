/**
 * API Versioning Service (Phase 17)
 * 
 * Manages API versions with:
 * - v1: Legacy API (backward compatibility)
 * - v2: New API with product codes, unified responses, rate limiting
 * - Graceful deprecation path
 * - Version negotiation
 */

export enum ApiVersion {
  V1 = "v1",
  V2 = "v2",
}

export interface VersionMetadata {
  version: ApiVersion;
  releaseDate: Date;
  deprecationDate?: Date;
  status: "stable" | "beta" | "deprecated";
  features: string[];
  breakingChanges: string[];
  migrationGuide?: string;
}

export interface VersionNegotiationResult {
  requestedVersion: ApiVersion | null;
  resolvedVersion: ApiVersion;
  isDeprecated: boolean;
  deprecationWarning?: string;
  migrationUrl?: string;
}

export class ApiVersioningService {
  private static readonly versions: Record<ApiVersion, VersionMetadata> = {
    [ApiVersion.V1]: {
      version: ApiVersion.V1,
      releaseDate: new Date("2025-01-01"),
      deprecationDate: new Date("2026-12-31"),
      status: "deprecated",
      features: [
        "Numeric product IDs",
        "Basic purchase endpoint",
        "Webhook delivery",
        "Polling support",
      ],
      breakingChanges: [],
      migrationGuide: "/docs/migration/v1-to-v2",
    },
    [ApiVersion.V2]: {
      version: ApiVersion.V2,
      releaseDate: new Date("2026-05-19"),
      status: "stable",
      features: [
        "Product codes (code-first API)",
        "Unified response model",
        "Correlation IDs",
        "Rate limiting",
        "Structured logging",
        "Failure codes",
        "Dead-letter queue",
        "Manual replay",
      ],
      breakingChanges: [
        "Product lookup now supports both codes and numeric IDs",
        "Purchase response includes correlationId",
        "Failure responses include failureCode",
        "Rate limiting enforced (60 req/min)",
      ],
    },
  };

  static negotiateVersion(
    acceptVersionHeader?: string,
    urlPath?: string
  ): VersionNegotiationResult {
    let requestedVersion: ApiVersion | null = null;
    let resolvedVersion = ApiVersion.V2;

    if (acceptVersionHeader) {
      const headerVersion = acceptVersionHeader.toLowerCase().trim();
      if (headerVersion === "v1") {
        requestedVersion = ApiVersion.V1;
        resolvedVersion = ApiVersion.V1;
      } else if (headerVersion === "v2") {
        requestedVersion = ApiVersion.V2;
        resolvedVersion = ApiVersion.V2;
      }
    }

    if (!requestedVersion && urlPath) {
      if (urlPath.includes("/v1/")) {
        requestedVersion = ApiVersion.V1;
        resolvedVersion = ApiVersion.V1;
      } else if (urlPath.includes("/v2/")) {
        requestedVersion = ApiVersion.V2;
        resolvedVersion = ApiVersion.V2;
      }
    }

    const metadata = this.versions[resolvedVersion];
    const isDeprecated = metadata.status === "deprecated";
    const deprecationWarning = isDeprecated
      ? `API version ${resolvedVersion} is deprecated as of ${metadata.deprecationDate?.toISOString().split("T")[0]}. Please migrate to v2.`
      : undefined;

    return {
      requestedVersion,
      resolvedVersion,
      isDeprecated,
      deprecationWarning,
      migrationUrl: metadata.migrationGuide,
    };
  }

  static getVersionMetadata(version: ApiVersion): VersionMetadata {
    return this.versions[version];
  }

  static getAllVersions(): Record<ApiVersion, VersionMetadata> {
    return this.versions;
  }

  static isVersionSupported(version: ApiVersion): boolean {
    return version in this.versions;
  }

  static getLatestStableVersion(): ApiVersion {
    for (const version of Object.values(ApiVersion)) {
      if (this.versions[version].status === "stable") {
        return version;
      }
    }
    return ApiVersion.V2;
  }

  static isVersionDeprecated(version: ApiVersion): boolean {
    return this.versions[version].status === "deprecated";
  }

  static getDeprecationInfo(version: ApiVersion): {
    isDeprecated: boolean;
    deprecationDate?: Date;
    migrationGuide?: string;
  } {
    const metadata = this.versions[version];
    return {
      isDeprecated: metadata.status === "deprecated",
      deprecationDate: metadata.deprecationDate,
      migrationGuide: metadata.migrationGuide,
    };
  }

  static getBreakingChanges(version: ApiVersion): string[] {
    return this.versions[version].breakingChanges;
  }

  static formatVersionHeader(version: ApiVersion): string {
    const metadata = this.versions[version];
    let header = `${version}`;

    if (metadata.status === "deprecated") {
      header += `; deprecated=true`;
      if (metadata.deprecationDate) {
        header += `; sunset=${metadata.deprecationDate.toISOString()}`;
      }
    }

    return header;
  }

  static getVersionConfig(version: ApiVersion): Record<string, any> {
    const configs: Record<ApiVersion, Record<string, any>> = {
      [ApiVersion.V1]: {
        productLookupBy: "numeric_id",
        responseFormat: "legacy",
        rateLimitPerMinute: null,
        correlationIdRequired: false,
        failureCodesRequired: false,
      },
      [ApiVersion.V2]: {
        productLookupBy: ["numeric_id", "product_code"],
        responseFormat: "unified",
        rateLimitPerMinute: 60,
        correlationIdRequired: true,
        failureCodesRequired: true,
        deadLetterQueueEnabled: true,
        manualReplayEnabled: true,
      },
    };

    return configs[version];
  }
}
