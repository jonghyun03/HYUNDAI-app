package kr.wooricha.fm

import android.app.PendingIntent
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionError
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

@androidx.media3.common.util.UnstableApi
class RadioService : MediaLibraryService() {
    private lateinit var catalog: RadioCatalog
    private lateinit var player: ExoPlayer
    private var librarySession: MediaLibrarySession? = null
    private val handler = Handler(Looper.getMainLooper())
    private val preferences by lazy { getSharedPreferences("playback", MODE_PRIVATE) }
    private val remember = object : Runnable {
        override fun run() { savePosition(); handler.postDelayed(this, 2000) }
    }

    override fun onCreate() {
        super.onCreate()
        catalog = RadioCatalog(this)
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
            setHandleAudioBecomingNoisy(true)
            setWakeMode(C.WAKE_MODE_LOCAL)
            setMediaItems(catalog.storyItems())
            seekTo(preferences.getInt("index", 0).coerceIn(0, catalog.stories.lastIndex), preferences.getLong("position", 0))
            playWhenReady = false
            prepare()
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) { savePosition() }
                override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) { savePosition() }
            })
        }
        val intent = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        librarySession = MediaLibrarySession.Builder(this, player, LibraryCallback()).setSessionActivity(intent).build()
        handler.post(remember)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = librarySession

    private fun savePosition() {
        if (!::player.isInitialized) return
        preferences.edit().putInt("index", player.currentMediaItemIndex.coerceAtLeast(0))
            .putLong("position", player.currentPosition.coerceAtLeast(0)).apply()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        savePosition()
        player.stop()
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        handler.removeCallbacks(remember)
        savePosition()
        librarySession?.release()
        player.release()
        librarySession = null
        super.onDestroy()
    }

    private inner class LibraryCallback : MediaLibrarySession.Callback {
        override fun onGetLibraryRoot(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, params: LibraryParams?): ListenableFuture<LibraryResult<MediaItem>> {
            val extras = Bundle().apply {
                putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1)
                putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1)
            }
            return Futures.immediateFuture(LibraryResult.ofItem(catalog.rootItem(), LibraryParams.Builder().setExtras(extras).build()))
        }

        override fun onGetChildren(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, parentId: String, page: Int, pageSize: Int, params: LibraryParams?): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val items = when (parentId) {
                RadioCatalog.ROOT_ID -> listOf(catalog.episodeItem())
                RadioCatalog.EPISODE_ID -> listOf(catalog.playAllItem()) + catalog.storyItems()
                else -> emptyList()
            }
            val start = (page.toLong() * pageSize).coerceAtMost(items.size.toLong()).toInt()
            val end = (start.toLong() + pageSize).coerceAtMost(items.size.toLong()).toInt()
            return Futures.immediateFuture(LibraryResult.ofItemList(items.subList(start, end), params))
        }

        override fun onGetItem(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, mediaId: String): ListenableFuture<LibraryResult<MediaItem>> {
            val item = when (mediaId) {
                RadioCatalog.ROOT_ID -> catalog.rootItem()
                RadioCatalog.EPISODE_ID -> catalog.episodeItem()
                RadioCatalog.PLAY_ALL_ID -> catalog.playAllItem()
                else -> catalog.storyItems().find { it.mediaId == mediaId }
            }
            return Futures.immediateFuture(if (item == null) LibraryResult.ofError(SessionError.ERROR_BAD_VALUE) else LibraryResult.ofItem(item, null))
        }

        override fun onAddMediaItems(session: MediaSession, controller: MediaSession.ControllerInfo, mediaItems: List<MediaItem>): ListenableFuture<List<MediaItem>> =
            Futures.immediateFuture(catalog.resolve(mediaItems))

        override fun onSearch(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, query: String, params: LibraryParams?): ListenableFuture<LibraryResult<Void>> {
            session.notifySearchResultChanged(browser, query, catalog.search(query).size, params)
            return Futures.immediateFuture(LibraryResult.ofVoid())
        }

        override fun onGetSearchResult(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, query: String, page: Int, pageSize: Int, params: LibraryParams?): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val items = catalog.search(query)
            val start = (page.toLong() * pageSize).coerceAtMost(items.size.toLong()).toInt()
            val end = (start.toLong() + pageSize).coerceAtMost(items.size.toLong()).toInt()
            return Futures.immediateFuture(LibraryResult.ofItemList(items.subList(start, end), params))
        }
    }
}
