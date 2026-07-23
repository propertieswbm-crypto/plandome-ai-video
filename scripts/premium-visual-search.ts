/**
 * Premium Visual Search Engine
 *
 * Intelligent multi-source visual search that ranks candidates
 * by contextual relevance, uniqueness, and quality.
 *
 * Instead of using the full sentence as a query, it understands
 * the intent and searches for the most contextually accurate visual.
 */

import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisualType } from "./premium-scene-intelligence";

export interface VisualSearchQuery {
    sceneId: string;
    sceneIndex: number;
    narration: string;
    visualType: VisualType;
    subject: string;
    environment: string;
    action: string;
    searchPriority: string[];
    avoidTerms: string[];
    usedSourceUrls: Set<string>;
    usedImageHashes: Set<string>;
}

export interface VisualSearchResult {
    success: boolean;
    sceneId: string;
    outputPath?: string;
    imagePath?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    license?: string;
    artist?: string;
    query?: string;
    matchScore: number;
    reason?: string;
}

interface CommonsImageInfo {
    url?: string;
    thumburl?: string;
    mime?: string;
    width?: number;
    height?: number;
    extmetadata?: Record<string, { value?: string }>;
}

interface CommonsPage {
    title?: string;
    imageinfo?: CommonsImageInfo[];
}

interface Candidate {
    page: CommonsPage;
    score: number;
    query: string;
    sourceUrl: string;
    mime: string;
    width: number;
    height: number;
    license: string;
    artist: string;
    title: string;
}

/**
 * Builds focused search queries based on visual type and intent.
 * Never uses the full sentence - extracts the core subject.
 */
export function buildFocusedQueries(
    subject: string,
    visualType: VisualType,
    searchPriority: string[]
): string[] {
    const queries: string[] = [];

    // Add visual-type-specific focused queries
    switch (visualType) {
        case "uk_victorian_property":
            queries.push(
                "Victorian terraced house London UK architecture exterior brick facade",
                "British period residential street UK architecture",
                "London Victorian house exterior street view"
            );
            break;
        case "planning_documents":
            queries.push(
                "UK planning application architectural drawings blueprint",
                "British council planning permission documents desk",
                "architectural plans UK residential building"
            );
            break;
        case "blueprint_animation":
            queries.push(
                "architectural blueprint technical drawing UK planning",
                "CAD drawing residential building UK architecture",
                "floor plan blueprint UK property construction"
            );
            break;
        case "structural_detail":
            queries.push(
                "UK building construction steel beam foundation detail",
                "residential structural inspection UK property renovation",
                "load bearing wall construction UK detail"
            );
            break;
        case "soil_cross_section":
            queries.push(
                "UK soil cross section geology clay construction",
                "geotechnical soil profile UK building ground",
                "London clay geological section construction"
            );
            break;
        case "tree_roots":
            queries.push(
                "UK tree root system foundation damage property",
                "British oak tree roots building structure",
                "tree preservation root protection UK construction"
            );
            break;
        case "drainage_system":
            queries.push(
                "UK drainage pipe system underground construction",
                "British sewer drain inspection property",
                "soakaway drainage field UK building"
            );
            break;
        case "commercial_premises":
            queries.push(
                "British high street shopfront commercial property UK",
                "London retail commercial building exterior",
                "UK office commercial property architecture exterior"
            );
            break;
        case "building_control_inspection":
            queries.push(
                "UK building regulations inspection construction site",
                "British building control officer survey property",
                "construction compliance check UK inspector"
            );
            break;
        case "aerial_view":
            queries.push(
                "UK residential area aerial drone view property",
                "British neighbourhood bird's eye view houses",
                "London roof aerial view residential street"
            );
            break;
        case "before_after_split":
            queries.push(
                "UK house renovation before after comparison exterior",
                "British property conversion transformation architecture",
                "London home extension before after street view"
            );
            break;
        case "infographic":
            queries.push(
                "UK property cost data chart construction budget",
                "British real estate infographic planning permission",
                "UK housing market statistics graph"
            );
            break;
        case "architectural_interior":
            queries.push(
                "UK Victorian house interior renovation period features",
                "British period property interior high ceiling room",
                "London home interior architecture living space"
            );
            break;
        case "cinematic_video":
            queries.push(
                "British residential street Victorian terraced houses",
                "UK city street architecture period buildings",
                "London residential road architecture street view"
            );
            break;
        case "construction_site":
            queries.push(
                "UK house construction site building development",
                "British residential building scaffolding extension",
                "London property renovation construction progress"
            );
            break;
        default:
            queries.push(
                "UK premium property architecture cinematography",
                "British residential architecture exterior street",
                "London professional property architectural photography"
            );
    }

    // Add priority terms from the intelligence analysis
    queries.push(...searchPriority.slice(0, 3));

    // Add focused subject-based query (not the full sentence)
    const subjectTerms = subject
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5)
        .join(" ");
    if (subjectTerms.length > 10) {
        queries.push(`UK ${subjectTerms} architecture property`);
    }

    return [...new Set(queries)].slice(0, 6);
}

/**
 * Searches Wikimedia Commons with intelligent query selection.
 */
async function searchCommons(
    query: string,
    timeoutMs = 15000
): Promise<CommonsPage[]> {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "6",
        gsrlimit: "50",
        prop: "imageinfo",
        iiprop: "url|mime|size|extmetadata",
        iiurlwidth: "1920",
        maxlag: "5",
        format: "json",
        origin: "*",
    }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                "user-agent":
                    "PlandomePremiumVideo/1.0 (UK property ad renderer; premium quality)",
            },
        });

        if (!response.ok) {
            throw new Error(`Wikimedia search returned HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as {
            query?: { pages?: Record<string, CommonsPage> };
        };

        return Object.values(payload.query?.pages || {});
    } catch (error) {
        throw error instanceof Error
            ? error
            : new Error("Wikimedia search failed.");
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Ranks candidates by contextual relevance using multiple signals.
 */
function rankCandidates(
    pages: CommonsPage[],
    query: string,
    visualType: VisualType,
    subject: string,
    environment: string,
    usedSourceUrls: Set<string>,
    avoidTerms: string[]
): Candidate[] {
    const queryTokens = query
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 3);

    const subjectTokens = subject
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 3);

    const avoidTokens = new Set(
        avoidTerms.flatMap((t) =>
            t.toLowerCase().split(/\W+/).filter(Boolean)
        )
    );

    const isPropertyType = [
        "uk_victorian_property",
        "cinematic_video",
        "aerial_view",
        "architectural_interior",
        "lifestyle_property",
    ].includes(visualType);

    const isTechnicalType = [
        "structural_detail",
        "soil_cross_section",
        "drainage_system",
        "blueprint_animation",
    ].includes(visualType);

    const candidates: Candidate[] = [];

    for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info?.url || !info.mime) continue;

        const license = info.extmetadata?.LicenseShortName?.value || "";
        const title = page.title || "";
        const lowerTitle = title.toLowerCase();

        // Must be CC or public domain
        if (!/CC|Public domain/i.test(license)) continue;

        // Only accept JPEG and PNG
        if (!["image/jpeg", "image/png"].includes(info.mime)) continue;

        // Minimum resolution
        if (Math.max(info.width || 0, info.height || 0) < 1600) continue;

        // Skip if already used
        if (usedSourceUrls.has(info.url)) continue;

        // Skip non-UK content
        if (
            /united states|america|california|florida|texas|canada|australia|india|japan|china/i.test(
                lowerTitle
            )
        ) {
            continue;
        }

        // Check avoid terms
        const titleWords = new Set(
            lowerTitle.split(/\W+/).filter(Boolean)
        );
        const hasAvoidTerm = [...avoidTokens].some((token) =>
            titleWords.has(token)
        );
        if (hasAvoidTerm) continue;

        // Filter out illustrations, diagrams for property types
        if (
            isPropertyType &&
            /map|diagram|coat of arms|flag|logo|icon|drawing|floor plan|site plan|illustration|cartoon|render/i.test(
                lowerTitle
            )
        ) {
            continue;
        }

        // Prefer real photos for technical types too (not diagrams)
        if (
            isTechnicalType &&
            /flag|logo|icon|coat of arms|cartoon/i.test(lowerTitle)
        ) {
            continue;
        }

        // Calculate relevance score
        let score = 0;

        // Query token match (highest weight)
        const queryMatchCount = queryTokens.filter((token) =>
            lowerTitle.includes(token)
        ).length;
        score += queryMatchCount * 8;

        // Subject token match
        const subjectMatchCount = subjectTokens.filter((token) =>
            lowerTitle.includes(token)
        ).length;
        score += subjectMatchCount * 6;

        // UK-specific boost
        if (
            /uk|united kingdom|british|england|london|britain|scotland|wales/i.test(
                lowerTitle
            )
        ) {
            score += 12;
        }

        // Architectural term boost
        if (
            /architecture|building|house|property|residential|victorian|georgian|edwardian|facade|brick|terrace/i.test(
                lowerTitle
            )
        ) {
            score += 8;
        }

        // Resolution bonus
        const dimensionScore = Math.min(
            8,
            Math.max(info.width || 0, info.height || 0) / 500
        );
        score += dimensionScore;

        // Penalize very generic terms
        if (
            /window|door|wall|room|garden|tree/i.test(lowerTitle) &&
            !queryTokens.some((t) => lowerTitle.includes(t))
        ) {
            score -= 4;
        }

        const artist = info.extmetadata?.Artist?.value
            ? info.extmetadata.Artist.value.replace(/<[^>]+>/g, " ").trim()
            : "";

        candidates.push({
            page,
            score,
            query,
            sourceUrl: info.url,
            mime: info.mime,
            width: info.width || 0,
            height: info.height || 0,
            license,
            artist,
            title,
        });
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 10);
}

/**
 * Downloads an image candidate and validates its content.
 */
async function downloadCandidate(
    candidate: Candidate,
    destination: string,
    timeoutMs = 30000
): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(candidate.sourceUrl, {
            signal: controller.signal,
            headers: {
                "user-agent":
                    "PlandomePremiumVideo/1.0 (UK property ad renderer; premium quality)",
            },
        });

        if (!response.ok) {
            throw new Error(`Download returned HTTP ${response.status}.`);
        }

        const data = Buffer.from(await response.arrayBuffer());

        if (data.length < 50000) {
            throw new Error(`Downloaded image was only ${data.length} bytes.`);
        }

        await writeFile(destination, data);
        return data;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Performs intelligent visual search for a scene.
 * Ranks multiple candidates and selects the most contextually accurate.
 */
export async function searchPremiumVisual(
    query: VisualSearchQuery
): Promise<VisualSearchResult> {
    const queries = buildFocusedQueries(
        query.subject,
        query.visualType,
        query.searchPriority
    );

    let lastError = "No suitable visual found.";
    let bestCandidate: Candidate | undefined;
    let bestQuery = "";

    // Search through each query tier
    for (const q of queries) {
        try {
            const pages = await searchCommons(q);
            const ranked = rankCandidates(
                pages,
                q,
                query.visualType,
                query.subject,
                query.environment,
                query.usedSourceUrls,
                query.avoidTerms
            );

            if (ranked.length > 0) {
                // Track best candidate overall
                if (!bestCandidate || ranked[0]!.score > bestCandidate.score) {
                    bestCandidate = ranked[0]!;
                    bestQuery = q;
                }

                // If we found a great match (score > 50), use it immediately
                if (ranked[0]!.score > 50) {
                    bestCandidate = ranked[0]!;
                    bestQuery = q;
                    break;
                }
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Search failed.";
        }
    }

    if (!bestCandidate) {
        return {
            success: false,
            sceneId: query.sceneId,
            matchScore: 0,
            reason: lastError,
        };
    }

    // Generate unique file hash
    const sourceHash = createHash("sha1")
        .update(bestCandidate.sourceUrl)
        .digest("hex")
        .slice(0, 10);

    const safeSceneId = query.sceneId.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60);
    const extension = bestCandidate.mime === "image/png" ? ".png" : ".jpg";
    const imageName = `${safeSceneId}-${sourceHash}${extension}`;
    const outputDir = bestCandidate.sourceUrl.includes("temp")
        ? path.resolve("assets", "generated-visuals")
        : path.resolve("assets", "generated-visuals");

    const imagePath = path.join(outputDir, imageName);

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    try {
        const imageData = await downloadCandidate(bestCandidate, imagePath);

        // Check content uniqueness
        const imageHash = createHash("sha256")
            .update(imageData)
            .digest("hex");

        if (query.usedImageHashes.has(imageHash)) {
            await unlink(imagePath).catch(() => undefined);
            return {
                success: false,
                sceneId: query.sceneId,
                matchScore: 0,
                reason: "Downloaded image content duplicates a previous scene.",
            };
        }

        query.usedImageHashes.add(imageHash);
        query.usedSourceUrls.add(bestCandidate.sourceUrl);

        return {
            success: true,
            sceneId: query.sceneId,
            outputPath: imagePath,
            imagePath,
            sourceUrl: bestCandidate.sourceUrl,
            sourceTitle: bestCandidate.title,
            license: bestCandidate.license,
            artist: bestCandidate.artist,
            query: bestQuery,
            matchScore: bestCandidate.score,
        };
    } catch (error) {
        await unlink(imagePath).catch(() => undefined);
        return {
            success: false,
            sceneId: query.sceneId,
            matchScore: 0,
            reason: error instanceof Error ? error.message : "Download failed.",
        };
    }
}

