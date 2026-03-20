/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
    baseUrl = "https://ww3.animeonline.ninja";

    getSettings(): Settings {
        return {
            episodeServers:[
                "YourUpload", "Fembed", "Streamtape", "Okru",
                "Doodstream", "MEGA", "Uqload", "Mp4Upload", "GoUnlimited", "Voe"
            ],
            supportsDub: true,
        };
    }

    async search(opts: SearchOptions): Promise<SearchResult[]> {
        const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(opts.query)}`;

        try {
            const res = await fetch(searchUrl, {
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            if (!res.ok) return[];
            const html = await res.text();

            const results: SearchResult[] =[];

            const $ = LoadDoc(html);

            $(".anime-card").each((_, el) => {
                const link = $(el).find("a").attr("href");
                const title = $(el).find(".anime-title").text();

                if (link && title) {
                    results.push({
                        id: link,
                        title: title.trim(),
                        url: link,
                        subOrDub: opts.dub ? "dub" : "sub"
                    });
                }
            });

            return results;
        } catch (error) {
            console.error("Error buscando en AnimeOnline Ninja:", error);
            return[];
        }
    }

    async findEpisodes(id: string): Promise<EpisodeDetails[]> {
        try {
            const res = await fetch(id, {
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            if (!res.ok) return[];
            const html = await res.text();

            const episodes: EpisodeDetails[] =[];
            const $ = LoadDoc(html);

            let index = 1;

            $(".episode a").each((_, el) => {
                const epUrl = $(el).attr("href");
                const textContent = $(el).text().trim();

                if (epUrl) {
                    const numMatch = textContent.match(/\d+/);
                    const epNum = numMatch ? parseInt(numMatch[0], 10) : index;

                    episodes.push({
                        id: epUrl,
                        number: epNum,
                        title: textContent || `Episode ${epNum}`,
                        url: epUrl,
                    });
                    index++;
                }
            });

            if (episodes.length > 1 && episodes[0].number > episodes[episodes.length - 1].number) {
                episodes.reverse();
            }

            const uniqueEpisodes: EpisodeDetails[] =[];
            const seenUrls = new Set();
            for (const ep of episodes) {
                if (!seenUrls.has(ep.url)) {
                    seenUrls.add(ep.url);
                    uniqueEpisodes.push(ep);
                }
            }

            return uniqueEpisodes;
        } catch (error) {
            console.error("Error buscando episodios:", error);
            return[];
        }
    }

    async findEpisodeServer(episode: EpisodeDetails, _server: string): Promise<EpisodeServer> {
        const res = await fetch(episode.url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!res.ok) throw new Error("No se pudo cargar el episodio.");
        const html = await res.text();

        const $ = LoadDoc(html);
        const streams: { url: string; serverName: string }[] =[];

        $("iframe").each((_, el) => {
            let src = $(el).attr("src");
            if (src) {
                if (src.startsWith("//")) src = "https:" + src;

                if (src.startsWith("http")) {
                    try {
                        const host = new URL(src).hostname;
                        let serverName = host.replace("www.", "");

                        if (/fembed|feurl|femax20|vanfem/.test(host)) serverName = "Fembed";
                        else if (/streamtape/.test(host)) serverName = "Streamtape";
                        else if (/ok\.ru|okru/.test(host)) serverName = "Okru";
                        else if (/dood/.test(host)) serverName = "Doodstream";
                        else if (/mega/.test(host)) serverName = "MEGA";
                        else if (/uqload/.test(host)) serverName = "Uqload";
                        else if (/yourupload/.test(host)) serverName = "YourUpload";
                        else if (/mp4upload/.test(host)) serverName = "Mp4Upload";
                        else if (/gounlimited/.test(host)) serverName = "GoUnlimited";
                        else if (/voe/.test(host)) serverName = "Voe";

                        streams.push({ url: src, serverName });
                    } catch (e) {
                    }
                }
            }
        });

        if (streams.length === 0) {
            throw new Error("No se encontraron servidores (iframes).");
        }

        let selectedStream = streams.find(s => s.serverName.toLowerCase() === _server.toLowerCase());
        if (!selectedStream) selectedStream = streams[0];

        const headers = {
            "Accept": "*/*",
            "User-Agent": "Mozilla/5.0",
        };

        if (selectedStream.serverName.toLowerCase() === "yourupload") {
            const yuHeaders = { ...headers, "Referer": "https://www.yourupload.com/" };
            const yuRes = await fetch(selectedStream.url);
            const yuHtml = await yuRes.text();

            let videoMatch = yuHtml.match(/<video[^>]+src=["']([^"']+)["']/i) || yuHtml.match(/file:\s*['"]([^'"]+\.mp4)['"]/i);

            if (!videoMatch || !videoMatch[1]) {
                throw new Error("No se encontró el video en YourUpload.");
            }

            const videoUrl = videoMatch[1];

            const finalReq = await fetch(videoUrl, { method: "GET", redirect: "manual", headers: yuHeaders });
            const finalUrl = finalReq.headers.get("location") || videoUrl;

            return {
                server: selectedStream.serverName,
                headers: yuHeaders,
                videoSources:[{
                    url: finalUrl,
                    type: "mp4",
                    quality: "Auto",
                    subtitles: []
                }]
            };
        }

        return {
            server: selectedStream.serverName,
            headers,
            videoSources:[{
                url: selectedStream.url,
                type: "unknown",
                quality: "Auto",
                subtitles: []
            }]
        };
    }
}
