/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
  baseUrl = "https://aniplaynow.live";

  getSettings(): Settings {
    return {
      episodeServers: ["yuki", "maze", "pahe"],
      supportsDub: true,
    };
  }

  async search(opts: SearchOptions): Promise<SearchResult[]> {
    try {
      const res = await fetch("https://graphql.anilist.co/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `query ($type: MediaType, $search: String, $sort:[MediaSort]=[POPULARITY_DESC,SCORE_DESC], $isAdult: Boolean) {
                        Page(perPage: 30) {
                            results: media(type: $type, search: $search, sort: $sort, isAdult: $isAdult) {
                                id
                                title { romaji english }
                            }
                        }
                    }`,
          variables: { search: opts.query, type: "ANIME", isAdult: false },
        }),
      });

      if (!res.ok) return [];

      const data = await res.json();
      const results: SearchResult[] = [];

      if (data?.data?.Page?.results) {
        for (const i of data.data.Page.results) {
          const title = i.title.english || i.title.romaji || "Unknown Anime";
          results.push({
            id: `${i.id}?type=${opts.dub ? "dub" : "sub"}`,
            title: title,
            url: `${this.baseUrl}/anime/info/${i.id}`,
            subOrDub: opts.dub ? "dub" : "sub",
          });
        }
      }
      return results;
    } catch (err) {
      console.error("Error en búsqueda AniPlay:", err);
      return [];
    }
  }

  async findEpisodes(id: string): Promise<EpisodeDetails[]> {
    const [anilistId, typeParam] = id.split("?type=");
    const type = typeParam || "sub";

    try {
      const res = await fetch(`${this.baseUrl}/anime/info/${anilistId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!res.ok) return [];
      const html = await res.text();

      let totalEpisodes = 1;
      const $ = LoadDoc(html);

      $("span").each((_, el) => {
        if ($(el).text().trim() === "Episodes") {
          const nextSpan = $(el).parent().find("span").eq(1).text().trim();
          if (nextSpan && !isNaN(parseInt(nextSpan))) {
            totalEpisodes = parseInt(nextSpan);
          }
        }
      });

      const episodes: EpisodeDetails[] = [];
      for (let i = 1; i <= totalEpisodes; i++) {
        episodes.push({
          id: `${anilistId}?ep=${i}&type=${type}`,
          number: i,
          title: `Episode ${i}`,
          url: `${this.baseUrl}/anime/watch/${anilistId}?ep=${i}`,
        });
      }

      return episodes;
    } catch (err) {
      console.error("Error buscando episodios AniPlay:", err);
      return [];
    }
  }

  async findEpisodeServer(
    episode: EpisodeDetails,
    _server: string,
  ): Promise<EpisodeServer> {
    const [anilistId, params] = episode.id.split("?");
    let epStr = "1";
    let type = "sub";

    if (params) {
      const parts = params.split("&");
      for (const p of parts) {
        if (p.startsWith("ep=")) epStr = p.replace("ep=", "");
        if (p.startsWith("type=")) type = p.replace("type=", "");
      }
    }

    const validServers = ["yuki", "maze", "pahe"];
    const host = validServers.includes(_server.toLowerCase())
      ? _server.toLowerCase()
      : "yuki";

    try {
      const providersRes = await fetch(
        `${this.baseUrl}/anime/info/${anilistId}`,
        {
          method: "POST",
          headers: {
            "Next-Action": "f3422af67c84852f5e63d50e1f51718f1c0225c4",
            "Content-Type": "text/plain",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify([anilistId, false, false]),
        },
      );

      const pDataStr = await providersRes.text();

      let pDataJsonStr = pDataStr.split("1:")[1] || pDataStr.split("0:")[1];
      if (!pDataJsonStr) {
        const line = pDataStr
          .split("\n")
          .find((l: string) => l.startsWith("1:") || l.startsWith("0:"));
        if (line) pDataJsonStr = line.substring(2);
      }

      if (!pDataJsonStr)
        throw new Error("No se pudo parsear la respuesta de proveedores.");
      const pData = JSON.parse(pDataJsonStr);

      let internalAnimeId = null;
      for (const provider of pData) {
        if (provider.providerId === host && provider.episodes) {
          const epData = provider.episodes[epStr];
          if (epData && epData.id) {
            internalAnimeId = epData.id;
            break;
          }
        }
      }

      if (!internalAnimeId)
        throw new Error(
          `El servidor ${host} no tiene este episodio disponible.`,
        );

      const sourcesRes = await fetch(
        `${this.baseUrl}/anime/watch/${anilistId}&host=${host}&type=${type}`,
        {
          method: "POST",
          headers: {
            "Next-Action": "5dbcd21c7c276c4d15f8de29d9ef27aef5ea4a5e",
            "Content-Type": "text/plain",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify([anilistId, host, internalAnimeId, epStr, type]),
        },
      );

      const dataStr = await sourcesRes.text();

      let dataJsonStr = dataStr.split("1:")[1] || dataStr.split("0:")[1];
      if (!dataJsonStr) {
        const line = dataStr
          .split("\n")
          .find((l: string) => l.startsWith("1:") || l.startsWith("0:"));
        if (line) dataJsonStr = line.substring(2);
      }

      if (!dataJsonStr)
        throw new Error("Error parseando las fuentes de video.");
      const data = JSON.parse(dataJsonStr);

      if (!data || !data.sources || data.sources.length === 0) {
        throw new Error("No hay fuentes disponibles en AniPlay.");
      }

      const subtitles: VideoSubtitle[] = [];
      if (data.subtitles) {
        for (const sub of data.subtitles) {
          subtitles.push({
            id: sub.lang,
            language: sub.lang,
            url: sub.url,
            isDefault:
              sub.lang.toLowerCase().includes("english") ||
              sub.lang.toLowerCase().includes("spanish"),
          });
        }
      }

      const videoSources: VideoSource[] = [];
      for (const src of data.sources) {
        videoSources.push({
          url: src.url,
          quality: src.quality || "Auto",
          type: src.isM3U8 ? "m3u8" : "mp4",
          subtitles: subtitles,
        });
      }

      return {
        server: host.toUpperCase(),
        headers: data.headers || { Referer: this.baseUrl },
        videoSources: videoSources,
      };
    } catch (err: any) {
      console.error("Error findEpisodeServer AniPlay:", err.message);
      throw err;
    }
  }
}
