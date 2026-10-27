package dev.pragu.agent

import android.net.LocalServerSocket
import android.net.LocalSocket
import android.net.LocalSocketAddress
import android.os.SystemClock
import android.util.Log
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

private const val ROOT_UID = 0
private const val SHELL_UID = 2000
private const val WATCHDOG_INTERVAL_MS = 1_000L

/** If the CLI crashes mid-session, the agent stops itself instead of holding UiAutomation forever. */
const val DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1_000L

/**
 * Only adb (which runs as the shell user) or root may talk to the agent. Without
 * this check, any other app on the device could connect to the socket and ask for
 * screenshots of whatever is on screen.
 */
fun isTrustedPeer(uid: Int): Boolean = uid == ROOT_UID || uid == SHELL_UID

/** Remembers the last sign of life; [isExpired] once nothing happened for [timeoutMs]. */
class IdleTimer(private val timeoutMs: Long, private val now: () -> Long) {
    @Volatile
    private var lastActivity = now()

    fun touch() {
        lastActivity = now()
    }

    fun isExpired(): Boolean = now() - lastActivity >= timeoutMs
}

/**
 * Serves requests on an abstract Unix socket. The CLI reaches it with
 * `adb forward tcp:0 localabstract:<name>`, so the agent never needs the INTERNET
 * permission and nothing listens on a network port on the device.
 */
class AgentServer(
    private val socketName: String,
    private val handler: RequestHandler,
    private val idleTimeoutMs: Long = DEFAULT_IDLE_TIMEOUT_MS,
) {
    private val stopped = AtomicBoolean(false)
    private val currentClient = AtomicReference<LocalSocket?>(null)

    fun serve() {
        // LocalServerSocket only implements Closeable from API 28, so `use {}` would crash on API 26–27.
        val server = LocalServerSocket(socketName)
        val idle = IdleTimer(idleTimeoutMs) { SystemClock.uptimeMillis() }
        val watchdog = startWatchdog(idle)
        try {
            Log.i(TAG, "Listening on @$socketName (idle timeout ${idleTimeoutMs / 1000} s)")
            while (!stopped.get()) {
                val client = server.accept()
                if (stopped.get()) {
                    client.close()
                    return
                }
                idle.touch()
                currentClient.set(client)
                val keepServing = try {
                    client.use { handle(it, idle) }
                } catch (e: IOException) {
                    if (!stopped.get()) Log.w(TAG, "A client connection failed", e)
                    true
                } finally {
                    currentClient.set(null)
                }
                if (!keepServing) return
            }
        } finally {
            stopped.set(true)
            watchdog.interrupt()
            server.close()
        }
    }

    private fun startWatchdog(idle: IdleTimer): Thread = thread(isDaemon = true, name = "pragu-idle-watchdog") {
        while (!stopped.get()) {
            try {
                Thread.sleep(WATCHDOG_INTERVAL_MS)
            } catch (_: InterruptedException) {
                return@thread
            }
            if (idle.isExpired() && stopped.compareAndSet(false, true)) {
                Log.i(TAG, "Idle for ${idleTimeoutMs / 1000} s; stopping")
                currentClient.get()?.close()
                wakeAcceptLoop()
                return@thread
            }
        }
    }

    /** Closing a LocalServerSocket does not reliably unblock accept(); a throwaway connection does. */
    private fun wakeAcceptLoop() {
        try {
            LocalSocket().use { it.connect(LocalSocketAddress(socketName)) }
        } catch (e: IOException) {
            Log.w(TAG, "Could not wake the accept loop", e)
        }
    }

    /** Handles one client until it disconnects; returns false when it asked the agent to stop. */
    private fun handle(client: LocalSocket, idle: IdleTimer): Boolean {
        val uid = client.peerCredentials.uid
        if (!isTrustedPeer(uid)) {
            Log.w(TAG, "Refused a connection from uid $uid")
            return true
        }
        val input = BufferedInputStream(client.inputStream)
        val output = BufferedOutputStream(client.outputStream)
        while (true) {
            val line = Frames.readLine(input) ?: return true
            idle.touch()
            val response = handler.handle(line)
            Frames.write(output, response)
            idle.touch()
            if (response.shutdown) return false
        }
    }
}
