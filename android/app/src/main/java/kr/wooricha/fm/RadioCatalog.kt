package kr.wooricha.fm

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.json.JSONObject

data class Story(val id: String, val title: String, val author: String, val startMs: Long, val endMs: Long)

@androidx.media3.common.util.UnstableApi
class RadioCatalog(context: Context) {
    companion object {
        const val ROOT_ID = "wooricha-root"
        const val EPISODE_ID = "wooricha-broadcast"
        const val PLAY_ALL_ID = "wooricha-play-all"
    }
    private val source = JSONObject(context.assets.open("broadcast.json").bufferedReader().use { it.readText() })
    val title: String = source.getString("title")
    val isDemo: Boolean = source.optBoolean("isDemo", false)
    val durationMs: Long = source.getLong("durationMs")
    val stories: List<Story> = source.getJSONArray("stories").let { array ->
        (0 until array.length()).map { i ->
            val s = array.getJSONObject(i)
            Story(s.getString("id"), s.getString("title"), s.getString("author"), s.getLong("startMs"), s.getLong("endMs"))
        }
    }
    private val audioUri = Uri.parse("android.resource://${context.packageName}/${R.raw.family_broadcast}")
    private val artwork = Uri.parse("android.resource://${context.packageName}/${R.drawable.ic_radio}")

    fun rootItem() = MediaItem.Builder().setMediaId(ROOT_ID).setMediaMetadata(
        MediaMetadata.Builder().setTitle("우리차 FM").setIsBrowsable(true).setIsPlayable(false)
            .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS).build()).build()

    fun episodeItem() = MediaItem.Builder().setMediaId(EPISODE_ID).setMediaMetadata(
        MediaMetadata.Builder().setTitle(title).setSubtitle(if (isDemo) "개인정보 없는 테스트 음원 ${stories.size}개" else "가족의 실제 목소리 ${stories.size}개")
            .setArtworkUri(artwork).setIsBrowsable(true).setIsPlayable(false)
            .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS).build()).build()

    fun playAllItem() = MediaItem.Builder().setMediaId(PLAY_ALL_ID).setMediaMetadata(
        MediaMetadata.Builder().setTitle("방송 처음부터 듣기").setAlbumTitle(title).setArtist("우리차 FM")
            .setArtworkUri(artwork).setIsBrowsable(false).setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_PODCAST_EPISODE).build()).build()

    fun storyItems(): List<MediaItem> = stories.map { story ->
        MediaItem.Builder().setMediaId(story.id).setUri(audioUri)
            .setClippingConfiguration(MediaItem.ClippingConfiguration.Builder()
                .setStartPositionMs(story.startMs).setEndPositionMs(story.endMs).build())
            .setMediaMetadata(MediaMetadata.Builder().setTitle(story.title).setArtist(story.author)
                .setAlbumTitle(title).setArtworkUri(artwork).setIsBrowsable(false).setIsPlayable(true)
                .setMediaType(MediaMetadata.MEDIA_TYPE_PODCAST_EPISODE).build()).build()
    }

    fun resolve(items: List<MediaItem>): List<MediaItem> = items.flatMap { item ->
        when (item.mediaId) {
            PLAY_ALL_ID, EPISODE_ID -> storyItems()
            else -> storyItems().filter { it.mediaId == item.mediaId }
        }
    }

    fun search(query: String): List<MediaItem> {
        if (query.isBlank() || title.contains(query, ignoreCase = true) || "우리차 FM".contains(query, ignoreCase = true)) return listOf(playAllItem())
        return storyItems().filter { "${it.mediaMetadata.title} ${it.mediaMetadata.artist}".contains(query, ignoreCase = true) }
    }
}
