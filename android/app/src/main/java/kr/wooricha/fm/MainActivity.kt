package kr.wooricha.fm

import android.app.Activity
import android.content.ComponentName
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import java.util.Locale

@androidx.media3.common.util.UnstableApi
class MainActivity : Activity() {
    private val ink = Color.rgb(224, 233, 211)
    private val muted = Color.rgb(151, 178, 159)
    private val coral = Color.rgb(244, 162, 128)
    private lateinit var catalog: RadioCatalog
    private var controller: MediaController? = null
    private var future: ListenableFuture<MediaController>? = null
    private var stopUxMonitoring: (() -> Unit)? = null
    private var restricted = true
    private lateinit var play: Button
    private lateinit var previous: Button
    private lateinit var next: Button
    private lateinit var now: TextView
    private lateinit var note: TextView
    private lateinit var clock: TextView
    private lateinit var progress: SeekBar
    private lateinit var stories: LinearLayout
    private val storyButtons = mutableListOf<Button>()
    private val handler = Handler(Looper.getMainLooper())
    private var dragging = false
    private val tick = object : Runnable {
        override fun run() { updatePlayer(); handler.postDelayed(this, 500) }
    }
    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = updatePlayer()
        override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) = updatePlayer()
        override fun onPlayerError(error: PlaybackException) { note.text = "방송을 재생하지 못했어요. 다시 재생해주세요." }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        catalog = RadioCatalog(this)
        createScreen()
        future = MediaController.Builder(this, SessionToken(this, ComponentName(this, RadioService::class.java))).buildAsync().also { pending ->
            pending.addListener({
                try {
                    controller = pending.get().also { it.addListener(listener) }
                    updatePlayer()
                } catch (_: Exception) { note.text = "방송에 연결하지 못했어요. 앱을 다시 열어주세요." }
            }, ContextCompat.getMainExecutor(this))
        }
        connectCar()
    }

    override fun onStart() { super.onStart(); handler.post(tick) }
    override fun onStop() { handler.removeCallbacks(tick); super.onStop() }
    override fun onDestroy() {
        handler.removeCallbacks(tick)
        controller?.removeListener(listener)
        future?.let { MediaController.releaseFuture(it) }
        stopUxMonitoring?.invoke()
        super.onDestroy()
    }
    override fun onConfigurationChanged(newConfig: Configuration) { super.onConfigurationChanged(newConfig); createScreen(); updatePlayer() }

    private fun connectCar() {
        try {
            // Pleos 2.1.0 does not expose android.car as a shared library.
            // Keep the basic playback UI restricted if the standard API is unavailable.
            Class.forName("android.car.Car")
            val monitor = StandardCarUxMonitor(this) { value ->
                runOnUiThread { restricted = value; applyRestrictions() }
            }
            stopUxMonitoring = { monitor.close() }
            monitor.start()
        } catch (_: ClassNotFoundException) { restricted = true; applyRestrictions() }
          catch (_: LinkageError) { restricted = true; applyRestrictions() }
          catch (_: Exception) { restricted = true; applyRestrictions() }
    }

    private fun applyRestrictions() {
        if (!::stories.isInitialized) return
        stories.visibility = if (restricted) View.GONE else View.VISIBLE
        progress.isEnabled = !restricted && controller != null
        note.text = if (restricted) "듣기에 집중할 수 있도록 기본 재생 조작만 보여드려요." else if (catalog.isDemo) "공개 데모 · 실제 목소리가 아닌 테스트 안내음입니다" else "오프라인 시연 · 가족의 실제 목소리가 담긴 방송"
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun label(text: String, size: Float, color: Int = ink, bold: Boolean = false) = TextView(this).apply {
        this.text = text; textSize = size; setTextColor(color)
        if (bold) typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        includeFontPadding = false
    }
    private fun rounded(color: Int, radius: Int = 18) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun gap(parent: LinearLayout, height: Int) { parent.addView(View(this), LinearLayout.LayoutParams(1, dp(height))) }
    private fun button(text: String, primary: Boolean = false) = Button(this).apply {
        this.text = text; textSize = if (primary) 25f else 20f; isAllCaps = false
        setTextColor(if (primary) Color.rgb(22, 56, 47) else ink)
        background = rounded(if (primary) coral else Color.rgb(40, 73, 61), 14)
        minHeight = dp(76); minimumWidth = dp(112); setPadding(dp(16), 0, dp(16), 0)
    }

    private fun createScreen() {
        val wide = resources.configuration.screenWidthDp >= 840
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(30), dp(22), dp(30), dp(18)); setBackgroundColor(Color.rgb(16, 46, 43)) }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(label("우리차 FM", 28f, ink, true), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        header.addView(label("우리의 목소리로 채우는 길", 17f, muted))
        root.addView(header)
        gap(root, 24)

        val content = LinearLayout(this).apply { orientation = if (wide) LinearLayout.HORIZONTAL else LinearLayout.VERTICAL; gravity = Gravity.CENTER_VERTICAL }
        if (wide) {
            content.addView(RecordArtwork(), LinearLayout.LayoutParams(dp(285), ViewGroup.LayoutParams.MATCH_PARENT).apply { rightMargin = dp(34) })
        }
        val playerPanel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_VERTICAL }
        playerPanel.addView(label("오늘도, 함께 듣는 길", 17f, muted))
        gap(playerPanel, 13)
        playerPanel.addView(label(catalog.title, if (wide) 38f else 30f, ink, true))
        gap(playerPanel, 14)
        now = label("방송에 연결하고 있어요", 21f, Color.rgb(207, 221, 184))
        playerPanel.addView(now)
        gap(playerPanel, 20)
        val controls = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        previous = button("이전 사연").apply { contentDescription = "이전 사연"; setOnClickListener { controller?.seekToPreviousMediaItem() } }
        play = button("재생", true).apply {
            contentDescription = "방송 재생"
            setOnClickListener {
                controller?.let { media ->
                    if (media.isPlaying) media.pause()
                    else {
                        if (media.playbackState == Player.STATE_ENDED) media.seekTo(0, 0)
                        if (media.playbackState == Player.STATE_IDLE) media.prepare()
                        media.play()
                    }
                }
            }
        }
        next = button("다음 사연").apply { contentDescription = "다음 사연"; setOnClickListener { controller?.seekToNextMediaItem() } }
        controls.addView(previous, LinearLayout.LayoutParams(0, dp(78), 1f).apply { rightMargin = dp(12) })
        controls.addView(play, LinearLayout.LayoutParams(0, dp(88), 1.15f).apply { rightMargin = dp(12) })
        controls.addView(next, LinearLayout.LayoutParams(0, dp(78), 1f))
        playerPanel.addView(controls)
        gap(playerPanel, 13)
        progress = SeekBar(this).apply {
            max = catalog.durationMs.toInt(); contentDescription = "방송 재생 위치"
            progressTintList = android.content.res.ColorStateList.valueOf(coral)
            thumbTintList = android.content.res.ColorStateList.valueOf(coral)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) = Unit
                override fun onStartTrackingTouch(seekBar: SeekBar?) { dragging = true }
                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    dragging = false
                    val position = (seekBar?.progress ?: 0).toLong()
                    val index = catalog.stories.indexOfLast { it.startMs <= position }.coerceAtLeast(0)
                    controller?.seekTo(index, position - catalog.stories[index].startMs)
                }
            })
        }
        playerPanel.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(42)))
        clock = label("0:00 / ${formatTime(catalog.durationMs)}", 16f, muted).apply { gravity = Gravity.END }
        playerPanel.addView(clock)
        if (wide) content.addView(playerPanel, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))
        else content.addView(playerPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(content, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        gap(root, 20)
        stories = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        storyButtons.clear()
        catalog.stories.forEachIndexed { index, story ->
            val item = Button(this).apply {
                text = "${index + 1}. ${story.title}"; textSize = 16f; isAllCaps = false; setTextColor(muted)
                background = rounded(Color.rgb(28, 62, 52), 10)
                setPadding(dp(12), dp(10), dp(12), dp(10)); maxLines = 2; minimumHeight = dp(64)
                contentDescription = "${index + 1}번 사연 ${story.title} 선택"
                setOnClickListener { controller?.seekTo(index, 0); updatePlayer() }
            }
            storyButtons.add(item)
            stories.addView(item, LinearLayout.LayoutParams(0, dp(70), 1f).apply { if (index < catalog.stories.lastIndex) rightMargin = dp(10) })
        }
        root.addView(stories)
        gap(root, 13)
        note = label("차량 상태를 확인하고 있어요", 13f, muted)
        root.addView(note)
        setContentView(root)
        applyRestrictions()
    }

    private fun updatePlayer() {
        if (!::play.isInitialized) return
        val media = controller
        play.isEnabled = media != null
        val index = (media?.currentMediaItemIndex ?: 0).coerceIn(0, catalog.stories.lastIndex)
        previous.isEnabled = media != null && index > 0
        next.isEnabled = media != null && index < catalog.stories.lastIndex
        play.text = if (media?.isPlaying == true) "일시정지" else "재생"
        play.contentDescription = if (media?.isPlaying == true) "방송 일시정지" else "방송 재생"
        if (media != null) {
            val story = catalog.stories[index]
            now.text = "${index + 1} / ${catalog.stories.size}  ·  ${story.title}"
            val absolute = (story.startMs + media.currentPosition.coerceAtLeast(0)).coerceAtMost(catalog.durationMs)
            if (!dragging) progress.progress = absolute.toInt()
            clock.text = "${formatTime(absolute)} / ${formatTime(catalog.durationMs)}"
            storyButtons.forEachIndexed { i, view -> view.setTextColor(if (i == index) coral else muted) }
        }
        progress.isEnabled = !restricted && media != null
    }

    private fun formatTime(ms: Long): String = String.format(Locale.ROOT, "%d:%02d", ms / 60000, (ms / 1000) % 60)

    private inner class RecordArtwork : View(this) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val size = minOf(width.toFloat(), height.toFloat() - dp(30)); val cx = width / 2f; val cy = height / 2f - dp(12)
            paint.style = Paint.Style.FILL; paint.color = Color.rgb(21, 49, 39); canvas.drawCircle(cx, cy, size*.47f, paint)
            paint.style = Paint.Style.STROKE; paint.strokeWidth = dp(1).toFloat(); paint.color = Color.rgb(41, 75, 53)
            for (i in 0..15) canvas.drawCircle(cx, cy, size*(.20f+i*.016f), paint)
            paint.style = Paint.Style.FILL; paint.color = Color.rgb(216, 226, 189); canvas.drawCircle(cx, cy, size*.20f, paint)
            paint.textAlign = Paint.Align.CENTER; paint.color = Color.rgb(33, 66, 46); paint.textSize = dp(20).toFloat(); paint.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            canvas.drawText("우리차",cx,cy-dp(2),paint); paint.textSize=dp(13).toFloat(); canvas.drawText("FM",cx,cy+dp(20),paint)
            paint.textSize=dp(16).toFloat(); paint.color=muted; canvas.drawText("서로 다른 하루, 같은 주파수.",cx,cy+size*.47f+dp(26),paint)
        }
    }
}
