const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://ww3.animeonline.ninja";

const manifest = {
    id: "org.stremio.animeonline",
    version: "1.5.0",
    name: "AnimeOnline Ninja",
    description: "Addon para ver anime desde animeonline.ninja",
    types: ["series"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
        {
            type: "series",
            id: "animeonlineCatalog",
            name: "AnimeOnline Ninja",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip", isRequired: false }
            ]
        }
    ],
    idPrefixes: ["animeonline:"]
};

const builder = new addonBuilder(manifest);

// ===== Helper para identificar servidores =====
function getServerName(url) {
    const host = new URL(url).hostname;

    if (/fembed|feurl|femax20|vanfem/.test(host)) return "Fembed";
    if (/streamtape/.test(host)) return "Streamtape";
    if (/ok\.ru|okru/.test(host)) return "Okru";
    if (/dood/.test(host)) return "Doodstream";
    if (/mega/.test(host)) return "MEGA";
    if (/uqload/.test(host)) return "Uqload";
    if (/yourupload/.test(host)) return "YourUpload";
    if (/mp4upload/.test(host)) return "Mp4Upload";
    if (/gounlimited/.test(host)) return "GoUnlimited";

    return host.replace("www.", "");
}

// ========== CATALOGO ==========
builder.defineCatalogHandler(async ({ id, type, extra }) => {
    const search = extra.search || "";
    const skip = parseInt(extra.skip || 0);

    try {
        let url;
        if (search) {
            url = `${BASE_URL}/?s=${encodeURIComponent(search)}`;
        } else {
            const page = Math.floor(skip / 20) + 1;
            url = `${BASE_URL}/anime/page/${page}/`;
        }

        const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(data);
        const metas = [];

        $(".anime-card a").each((i, el) => {
            const link = $(el).attr("href");
            const title = $(el).find(".anime-title").text().trim();
            const poster = $(el).find("img").attr("src");

            if (link && title) {
                metas.push({
                    id: "animeonline:" + link,
                    type: "series",
                    name: title,
                    poster: poster || null
                });
            }
        });

        return { metas };
    } catch (err) {
        console.error("❌ Error en catálogo:", err.message);
        return { metas: [] };
    }
});

// ========== META ==========
builder.defineMetaHandler(async ({ id }) => {
    const url = id.replace("animeonline:", "");

    try {
        const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(data);

        const title = $(".anime__details__title h3").text().trim() || "Anime sin título";
        const description = $(".anime__details__text p").first().text().trim() || "Sin descripción";
        const poster = $(".anime__details__pic").attr("data-setbg") || null;

        const videos = [];

        // Temporadas
        $(".season, .season-block, .seasons, .tab-content").each((seasonIndex, seasonBlock) => {
            const seasonNum = seasonIndex + 1;

            $(seasonBlock).find(".episode a").each((i, el) => {
                const epUrl = $(el).attr("href");
                const epNum = $(el).text().trim().match(/\d+/)?.[0] || (i + 1);

                if (epUrl) {
                    videos.push({
                        id: "animeonline:" + epUrl,
                        title: `Episodio ${epNum}`,
                        season: seasonNum,
                        episode: parseInt(epNum)
                    });
                }
            });
        });

        if (videos.length === 0) {
            $(".episode a").each((i, el) => {
                const epUrl = $(el).attr("href");
                const epNum = $(el).text().trim().match(/\d+/)?.[0] || (i + 1);

                if (epUrl) {
                    videos.push({
                        id: "animeonline:" + epUrl,
                        title: `Episodio ${epNum}`,
                        season: 1,
                        episode: parseInt(epNum)
                    });
                }
            });
        }

        return {
            meta: {
                id,
                type: "series",
                name: title,
                poster,
                description,
                videos
            }
        };
    } catch (err) {
        console.error("❌ Error en meta:", err.message);
        return { meta: null };
    }
});

// ========== STREAMS ==========
builder.defineStreamHandler(async ({ id }) => {
    const url = id.replace("animeonline:", "");

    try {
        const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(data);
        const streams = [];

        $("iframe").each((i, el) => {
            const src = $(el).attr("src");
            if (src && src.startsWith("http")) {
                streams.push({
                    title: getServerName(src),
                    url: src,
                    behaviorHints: { notWebReady: true }
                });
            }
        });

        return { streams };
    } catch (err) {
        console.error("❌ Error en streams:", err.message);
        return { streams: [] };
    }
});

// ========= SERVIDOR =========
const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🔥 Addon disponible en http://localhost:${PORT}/manifest.json`);
