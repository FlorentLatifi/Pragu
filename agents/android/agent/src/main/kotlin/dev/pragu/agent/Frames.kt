package dev.pragu.agent

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

/** Wire protocol version, shared with the CLI (packages/cli/src/protocol.ts). */
const val PROTOCOL_VERSION = 4

private const val MAX_REQUEST_BYTES = 64 * 1024

class Payload(val name: String, val type: String, val bytes: ByteArray)

/** A response is one JSON header line, followed by the payloads it announces, back to back. */
class Response(
    val ok: Boolean,
    val error: String? = null,
    val data: JSONObject? = null,
    val payloads: List<Payload> = emptyList(),
    val shutdown: Boolean = false,
) {
    fun header(): String {
        val header = JSONObject().put("ok", ok)
        if (error != null) header.put("error", error)
        if (data != null) header.put("data", data)
        if (payloads.isNotEmpty()) {
            val announced = JSONArray()
            payloads.forEach { payload ->
                announced.put(JSONObject().put("name", payload.name).put("bytes", payload.bytes.size).put("type", payload.type))
            }
            header.put("payloads", announced)
        }
        return header.toString()
    }

    companion object {
        fun failure(message: String) = Response(ok = false, error = message)
    }
}

object Frames {
    /** Reads one UTF-8 request line, or returns null when the client has gone. */
    fun readLine(input: InputStream): String? {
        val buffer = ByteArrayOutputStream()
        while (true) {
            val byte = input.read()
            if (byte == -1) return if (buffer.size() == 0) null else buffer.toString(Charsets.UTF_8.name())
            if (byte == '\n'.code) return buffer.toString(Charsets.UTF_8.name())
            if (buffer.size() >= MAX_REQUEST_BYTES) throw IOException("Request line is longer than $MAX_REQUEST_BYTES bytes")
            buffer.write(byte)
        }
    }

    fun write(output: OutputStream, response: Response) {
        output.write((response.header() + "\n").toByteArray(Charsets.UTF_8))
        response.payloads.forEach { output.write(it.bytes) }
        output.flush()
    }
}
