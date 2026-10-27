package dev.pragu.agent

import android.net.LocalServerSocket
import android.net.LocalSocket
import android.util.Log
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.IOException

private const val ROOT_UID = 0
private const val SHELL_UID = 2000

/**
 * Only adb (which runs as the shell user) or root may talk to the agent. Without
 * this check, any other app on the device could connect to the socket and ask for
 * screenshots of whatever is on screen.
 */
fun isTrustedPeer(uid: Int): Boolean = uid == ROOT_UID || uid == SHELL_UID

/**
 * Serves requests on an abstract Unix socket. The CLI reaches it with
 * `adb forward tcp:0 localabstract:<name>`, so the agent never needs the INTERNET
 * permission and nothing listens on a network port on the device.
 */
class AgentServer(private val socketName: String, private val handler: RequestHandler) {
    fun serve() {
        LocalServerSocket(socketName).use { server ->
            Log.i(TAG, "Listening on @$socketName")
            while (true) {
                val client = server.accept()
                val keepServing = try {
                    client.use { handle(it) }
                } catch (e: IOException) {
                    Log.w(TAG, "A client connection failed", e)
                    true
                }
                if (!keepServing) return
            }
        }
    }

    /** Handles one client until it disconnects; returns false when it asked the agent to stop. */
    private fun handle(client: LocalSocket): Boolean {
        val uid = client.peerCredentials.uid
        if (!isTrustedPeer(uid)) {
            Log.w(TAG, "Refused a connection from uid $uid")
            return true
        }
        val input = BufferedInputStream(client.inputStream)
        val output = BufferedOutputStream(client.outputStream)
        while (true) {
            val line = Frames.readLine(input) ?: return true
            val response = handler.handle(line)
            Frames.write(output, response)
            if (response.shutdown) return false
        }
    }
}
