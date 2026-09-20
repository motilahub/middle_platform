function mapItem(row) {
  return {
    id: Number(row.id),
    source: row.source,
    externalId: row.external_id,
    mediaType: row.media_type,
    contentCategory: row.content_category || 'general',
    title: row.title,
    originalTitle: row.original_title,
    year: row.year,
    posterUrl: row.poster_url,
    rating: row.rating === null ? null : Number(row.rating),
    ranking: row.ranking,
    summary: row.summary,
    releaseDate: row.release_date instanceof Date ? row.release_date.toISOString().slice(0, 10) : row.release_date,
    runtimeMinutes: row.runtime_minutes,
    genres: row.genres || [],
    countries: row.countries || [],
    languages: row.languages || [],
    directors: row.directors || [],
    castMembers: row.cast_members || [],
    episodeCount: row.episode_count,
    totalEpisodeCount: row.total_episode_count,
    availableEpisodeCount: row.available_episode_count,
    episodeStatus: row.episode_status || 'unknown',
    sourceUrl: row.source_url,
    metadata: row.metadata || {},
    isRanked: row.is_ranked,
    addedManually: row.added_manually,
    detailSyncedAt: row.detail_synced_at,
    rankingSyncedAt: row.ranking_synced_at,
  }
}

export function createMediaLibraryRepository(pool) {
  return {
    async list(mediaType, keyword = '', includeInactive = false, contentCategory = null) {
      const result = await pool.query(`SELECT * FROM media_items
        WHERE ($1::text IS NULL OR media_type=$1)
          AND ($3::boolean=TRUE OR is_ranked=TRUE OR added_manually=TRUE)
          AND ($4::text IS NULL OR content_category=$4)
          AND ($2='' OR title ILIKE '%' || $2 || '%' OR COALESCE(original_title,'') ILIKE '%' || $2 || '%')
        ORDER BY (is_ranked OR added_manually) DESC, ranking NULLS LAST, rating DESC NULLS LAST, id`, [mediaType, keyword, includeInactive, contentCategory])
      return result.rows.map(mapItem)
    },

    async get(id) {
      const result = await pool.query('SELECT * FROM media_items WHERE id=$1', [id])
      return result.rowCount ? mapItem(result.rows[0]) : null
    },

    async createItem(item) {
      const result = await pool.query(`INSERT INTO media_items(
          source,external_id,media_type,title,original_title,year,poster_url,rating,summary,
          episode_count,total_episode_count,available_episode_count,episode_status,source_url,
          content_category,release_date,runtime_minutes,genres,countries,languages,directors,cast_members,
          metadata,is_ranked,added_manually,detail_synced_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20,$21,$22,'{}'::jsonb,FALSE,TRUE,NOW())
        RETURNING *`, [
        item.source, item.externalId, item.mediaType, item.title, item.originalTitle, item.year,
        item.posterUrl, item.rating, item.summary, item.episodeCount, item.totalEpisodeCount,
        item.availableEpisodeCount, item.episodeStatus, item.sourceUrl,
        item.contentCategory, item.releaseDate, item.runtimeMinutes, item.genres,
        item.countries, item.languages, item.directors, item.castMembers,
      ])
      return mapItem(result.rows[0])
    },

    async updateItem(id, item) {
      const result = await pool.query(`UPDATE media_items SET
          media_type=$1,title=$2,original_title=$3,year=$4,poster_url=$5,rating=$6,summary=$7,
          episode_count=$8,total_episode_count=$9,available_episode_count=$10,episode_status=$11,
          source_url=$12,content_category=$13,release_date=$14,runtime_minutes=$15,
          genres=$16,countries=$17,languages=$18,directors=$19,cast_members=$20,
          added_manually=TRUE,metadata=metadata - 'episodesInfo',updated_at=NOW()
        WHERE id=$21 RETURNING *`, [
        item.mediaType, item.title, item.originalTitle, item.year, item.posterUrl, item.rating,
        item.summary, item.episodeCount, item.totalEpisodeCount, item.availableEpisodeCount,
        item.episodeStatus, item.sourceUrl, item.contentCategory, item.releaseDate,
        item.runtimeMinutes, item.genres, item.countries, item.languages, item.directors,
        item.castMembers, id,
      ])
      return result.rowCount ? mapItem(result.rows[0]) : null
    },

    async deleteItems(ids) {
      const result = await pool.query('DELETE FROM media_items WHERE id=ANY($1::bigint[]) RETURNING id', [ids])
      return result.rowCount
    },

    async listEpisodeSources() {
      const result = await pool.query(`SELECT * FROM media_items
        WHERE source='douban' AND media_type='tv' AND (is_ranked=TRUE OR added_manually=TRUE)
        ORDER BY id`)
      return result.rows.map(mapItem)
    },

    async updateEpisodeProgress(item) {
      const result = await pool.query(`UPDATE media_items SET
          total_episode_count=COALESCE($1,total_episode_count),
          available_episode_count=COALESCE($2,available_episode_count),
          episode_status=CASE WHEN $3='unknown' AND episode_status<>'unknown' THEN episode_status ELSE $3 END,
          episode_count=COALESCE($2,$1,episode_count),
          metadata=CASE WHEN $4='' THEN metadata ELSE metadata || jsonb_build_object('episodesInfo',$4) END,
          detail_synced_at=NOW(),
          updated_at=NOW()
        WHERE source='douban' AND external_id=$5
        RETURNING *`, [
        item.totalEpisodeCount, item.availableEpisodeCount, item.episodeStatus,
        item.metadata?.episodesInfo || '', item.externalId,
      ])
      return result.rowCount ? mapItem(result.rows[0]) : null
    },

    async existingExternalIds(source, externalIds) {
      if (!externalIds.length) return new Set()
      const result = await pool.query(
        'SELECT external_id FROM media_items WHERE source=$1 AND (is_ranked OR added_manually) AND external_id=ANY($2::text[])',
        [source, externalIds],
      )
      return new Set(result.rows.map((row) => row.external_id))
    },

    async importItem(item) {
      const existing = await pool.query(
        'SELECT id FROM media_items WHERE source=$1 AND external_id=$2',
        [item.source, item.externalId],
      )
      const result = await pool.query(`INSERT INTO media_items(
          source,external_id,media_type,title,original_title,year,poster_url,rating,ranking,summary,
          episode_count,total_episode_count,available_episode_count,episode_status,source_url,metadata,
          content_category,release_date,runtime_minutes,genres,countries,languages,directors,cast_members,
          is_ranked,added_manually,detail_synced_at,ranking_synced_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13,$14,$15::jsonb,
          $16,$17,$18,$19,$20,$21,$22,$23,FALSE,TRUE,NOW(),NULL)
        ON CONFLICT(source,external_id) DO UPDATE SET
          media_type=EXCLUDED.media_type,
          title=EXCLUDED.title,
          original_title=COALESCE(EXCLUDED.original_title,media_items.original_title),
          year=COALESCE(EXCLUDED.year,media_items.year),
          poster_url=COALESCE(EXCLUDED.poster_url,media_items.poster_url),
          rating=EXCLUDED.rating,
          summary=COALESCE(NULLIF(EXCLUDED.summary,''),media_items.summary),
          episode_count=COALESCE(EXCLUDED.episode_count,media_items.episode_count),
          total_episode_count=COALESCE(EXCLUDED.total_episode_count,media_items.total_episode_count),
          available_episode_count=COALESCE(EXCLUDED.available_episode_count,media_items.available_episode_count),
          episode_status=CASE
            WHEN EXCLUDED.episode_status='unknown' AND media_items.episode_status<>'unknown' THEN media_items.episode_status
            ELSE EXCLUDED.episode_status
          END,
          source_url=EXCLUDED.source_url,
          metadata=media_items.metadata || EXCLUDED.metadata,
          content_category=EXCLUDED.content_category,
          release_date=COALESCE(EXCLUDED.release_date,media_items.release_date),
          runtime_minutes=COALESCE(EXCLUDED.runtime_minutes,media_items.runtime_minutes),
          genres=CASE WHEN cardinality(EXCLUDED.genres)>0 THEN EXCLUDED.genres ELSE media_items.genres END,
          countries=CASE WHEN cardinality(EXCLUDED.countries)>0 THEN EXCLUDED.countries ELSE media_items.countries END,
          languages=CASE WHEN cardinality(EXCLUDED.languages)>0 THEN EXCLUDED.languages ELSE media_items.languages END,
          directors=CASE WHEN cardinality(EXCLUDED.directors)>0 THEN EXCLUDED.directors ELSE media_items.directors END,
          cast_members=CASE WHEN cardinality(EXCLUDED.cast_members)>0 THEN EXCLUDED.cast_members ELSE media_items.cast_members END,
          added_manually=TRUE,
          detail_synced_at=NOW(),
          updated_at=NOW()
        RETURNING *`, [
        item.source, item.externalId, item.mediaType, item.title, item.originalTitle, item.year,
        item.posterUrl, item.rating, item.summary, item.episodeCount, item.totalEpisodeCount,
        item.availableEpisodeCount, item.episodeStatus, item.sourceUrl,
        JSON.stringify(item.metadata || {}),
        item.contentCategory || 'general', item.releaseDate || null, item.runtimeMinutes || null,
        item.genres || [], item.countries || [], item.languages || [], item.directors || [], item.castMembers || [],
      ])
      return { item: mapItem(result.rows[0]), inserted: !existing.rowCount }
    },

    async sync(mediaType, items) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const externalIds = items.map((item) => item.externalId)
        const existing = new Set((await client.query(
          'SELECT external_id FROM media_items WHERE source=$1 AND external_id=ANY($2::text[])',
          ['douban', externalIds],
        )).rows.map((row) => row.external_id))
        await client.query(`UPDATE media_items SET is_ranked=FALSE, ranking=NULL, updated_at=NOW()
          WHERE source='douban' AND media_type=$1 AND NOT (external_id=ANY($2::text[]))`, [mediaType, externalIds])
        for (const item of items) {
          await client.query(`INSERT INTO media_items(
              source,external_id,media_type,title,original_title,year,poster_url,rating,ranking,summary,
              episode_count,total_episode_count,available_episode_count,episode_status,source_url,metadata,
              is_ranked,detail_synced_at,ranking_synced_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,TRUE,NOW(),NOW())
            ON CONFLICT(source,external_id) DO UPDATE SET
              media_type=EXCLUDED.media_type,
              title=EXCLUDED.title,
              original_title=COALESCE(EXCLUDED.original_title,media_items.original_title),
              year=COALESCE(EXCLUDED.year,media_items.year),
              poster_url=COALESCE(EXCLUDED.poster_url,media_items.poster_url),
              rating=EXCLUDED.rating,
              ranking=EXCLUDED.ranking,
              summary=COALESCE(NULLIF(EXCLUDED.summary,''),media_items.summary),
              episode_count=COALESCE(EXCLUDED.episode_count,media_items.episode_count),
              total_episode_count=COALESCE(EXCLUDED.total_episode_count,media_items.total_episode_count),
              available_episode_count=COALESCE(EXCLUDED.available_episode_count,media_items.available_episode_count),
              episode_status=CASE
                WHEN EXCLUDED.episode_status='unknown' AND media_items.episode_status<>'unknown' THEN media_items.episode_status
                ELSE EXCLUDED.episode_status
              END,
              source_url=EXCLUDED.source_url,
              metadata=media_items.metadata || EXCLUDED.metadata,
              is_ranked=TRUE,
              detail_synced_at=CASE WHEN COALESCE(media_items.detail_synced_at,'epoch'::timestamptz) < NOW() - INTERVAL '7 days' THEN NOW() ELSE media_items.detail_synced_at END,
              ranking_synced_at=NOW(),
              updated_at=NOW()`, [
            item.source, item.externalId, item.mediaType, item.title, item.originalTitle, item.year,
            item.posterUrl, item.rating, item.ranking, item.summary, item.episodeCount,
            item.totalEpisodeCount, item.availableEpisodeCount, item.episodeStatus, item.sourceUrl,
            JSON.stringify(item.metadata || {}),
          ])
        }
        await client.query('COMMIT')
        return { inserted: items.filter((item) => !existing.has(item.externalId)).length, updated: items.filter((item) => existing.has(item.externalId)).length }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
  }
}
