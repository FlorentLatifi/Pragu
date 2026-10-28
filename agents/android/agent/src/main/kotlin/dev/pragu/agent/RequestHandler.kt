package dev.pragu.agent

import org.json.JSONException
import org.json.JSONObject

/** Reads the screen. [UiAutomationCapturer] is the real one; unit tests use a fake. */
interface ScreenCapturer {
    fun deviceInfo(): DeviceInfo
    fun capture(packageName: String?, timeoutMs: Long): Capture
}

/** A capture problem the user can act on; its message goes back to the CLI unchanged. */
class CaptureException(message: String) : Exception(message)

class RequestHandler(private val capturer: ScreenCapturer, private val agentVersion: String) {
    fun handle(line: String): Response {
        val request = try {
            JSONObject(line)
        } catch (e: JSONException) {
            return Response.failure("The request is not valid JSON: ${e.message}")
        }
        return when (val command = request.optString("cmd")) {
            "hello" -> Response(
                ok = true,
                data = JSONObject()
                    .put("agentVersion", agentVersion)
                    .put("protocol", PROTOCOL_VERSION)
                    .put("device", capturer.deviceInfo().toJson()),
            )
            "capture" -> capture(request)
            "shutdown" -> Response(ok = true, shutdown = true)
            else -> Response.failure("Unknown command \"$command\". Expected hello, capture or shutdown.")
        }
    }

    private fun capture(request: JSONObject): Response {
        val packageName = request.optString("packageName").ifEmpty { null }
        val timeoutMs = request.optLong("timeoutMs", DEFAULT_TIMEOUT_MS).coerceIn(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
        return try {
            val capture = capturer.capture(packageName, timeoutMs)
            val tree = capture.toJson(capturer.deviceInfo(), agentVersion).toString().toByteArray(Charsets.UTF_8)
            Response(
                ok = true,
                data = JSONObject()
                    .put("packageName", capture.packageName)
                    .put("windows", capture.windows.size)
                    .put("nodes", capture.nodeCount()),
                payloads = listOf(
                    Payload("tree", "application/json", tree),
                    Payload("screenshot", "image/png", capture.png),
                ),
            )
        } catch (e: CaptureException) {
            Response.failure(e.message ?: "The capture failed.")
        }
    }

    private companion object {
        const val DEFAULT_TIMEOUT_MS = 30_000L
        const val MIN_TIMEOUT_MS = 1_000L
        const val MAX_TIMEOUT_MS = 120_000L
    }
}
