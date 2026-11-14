package kr.wooricha.fm

import android.content.ComponentName
import android.media.browse.MediaBrowser as LegacyBrowser
import android.os.Bundle
import android.os.SystemClock
import androidx.media3.common.Player
import androidx.media3.session.MediaBrowser
import androidx.media3.session.SessionToken
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.common.util.concurrent.ListenableFuture
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
@androidx.media3.common.util.UnstableApi
class MediaIntegrationTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private fun main(block: () -> Unit) = instrumentation.runOnMainSync(block)

    private fun awaitState(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 15000
        while (SystemClock.elapsedRealtime() < deadline) {
            var ready = false
            main { ready = condition() }
            if (ready) return
            Thread.sleep(50)
        }
        fail(message)
    }

    @Test fun playbackStartsMovesToNextStoryAndPauses() {
        lateinit var pending: ListenableFuture<MediaBrowser>
        main { pending = MediaBrowser.Builder(context, SessionToken(context, ComponentName(context, RadioService::class.java))).buildAsync() }
        val browser = pending.get(15, TimeUnit.SECONDS)
        try {
            main {
                browser.setMediaItems(RadioCatalog(context).storyItems())
                browser.prepare()
                browser.play()
            }
            awaitState("Playback advances") { browser.isPlaying && browser.currentPosition > 100 }
            main { browser.pause(); browser.seekTo(0, 0); browser.seekToNextMediaItem() }
            awaitState("Next story selected") { browser.currentMediaItemIndex == 1 }
            main { browser.play() }
            awaitState("Next story plays") { browser.isPlaying && browser.currentPosition > 100 }
            main { browser.pause() }
            awaitState("Playback pauses") { !browser.isPlaying && !browser.playWhenReady }
            main { assertNull(browser.playerError) }
        } finally {
            main { browser.pause(); browser.seekTo(0, 0); browser.release() }
        }
    }

    @Test fun media3BrowserFindsBroadcastAndStoriesWithoutAutoplay() {
        lateinit var pending: ListenableFuture<MediaBrowser>
        main { pending = MediaBrowser.Builder(context, SessionToken(context, ComponentName(context, RadioService::class.java))).buildAsync() }
        val browser = pending.get(15, TimeUnit.SECONDS)
        try {
            lateinit var rootFuture: ListenableFuture<androidx.media3.session.LibraryResult<androidx.media3.common.MediaItem>>
            main { rootFuture = browser.getLibraryRoot(null) }
            assertEquals(RadioCatalog.ROOT_ID, rootFuture.get(10, TimeUnit.SECONDS).value?.mediaId)
            lateinit var episodeFuture: ListenableFuture<androidx.media3.session.LibraryResult<com.google.common.collect.ImmutableList<androidx.media3.common.MediaItem>>>
            main { episodeFuture = browser.getChildren(RadioCatalog.ROOT_ID, 0, 20, null) }
            assertEquals(1, episodeFuture.get(10, TimeUnit.SECONDS).value?.size)
            main { episodeFuture = browser.getChildren(RadioCatalog.EPISODE_ID, 0, 20, null) }
            assertEquals(RadioCatalog(context).stories.size + 1, episodeFuture.get(10, TimeUnit.SECONDS).value?.size)
            main { assertFalse(browser.isPlaying) }
        } finally { main { browser.release() } }
    }

    @Test fun legacyMediaBrowserServiceIsCompatibleWithVehicleHost() {
        val connected = CountDownLatch(1)
        val loaded = CountDownLatch(1)
        var childCount = -1
        lateinit var browser: LegacyBrowser
        main {
            browser = LegacyBrowser(context, ComponentName(context, RadioService::class.java), object : LegacyBrowser.ConnectionCallback() {
                override fun onConnected() { connected.countDown() }
            }, Bundle())
            browser.connect()
        }
        try {
            assertTrue("Legacy MBS connection", connected.await(15, TimeUnit.SECONDS))
            main {
                assertEquals(RadioCatalog.ROOT_ID, browser.root)
                browser.subscribe(browser.root, object : LegacyBrowser.SubscriptionCallback() {
                    override fun onChildrenLoaded(parentId: String, children: MutableList<LegacyBrowser.MediaItem>) {
                        childCount = children.size; loaded.countDown()
                    }
                })
            }
            assertTrue("Legacy media library", loaded.await(10, TimeUnit.SECONDS))
            assertEquals(1, childCount)
        } finally { main { browser.disconnect() } }
    }
}
