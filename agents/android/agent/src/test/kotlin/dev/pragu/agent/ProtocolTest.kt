package dev.pragu.agent

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException

private class FakeCapturer(private val failure: String? = null) : ScreenCapturer {
    var lastPackage: String? = null
    var lastTimeout: Long = 0

    override fun deviceInfo() = DeviceInfo("Google", "Pixel", 36, "16", 420, 1.0f, "en-US", false)

    override fun capture(packageName: String?, timeoutMs: Long): Capture {
        lastPackage = packageName
        lastTimeout = timeoutMs
        if (failure != null) throw CaptureException(failure)
        return Capture("com.example.shop", "Shop", "2026-10-27T12:00:00Z", 1080, 2400, snapshot(text = "Hi"), byteArrayOf(9, 8, 7))
    }
}

class FramesTest {
    @Test
    fun headerAnnouncesPayloadsInOrder() {
        val response = Response(
            ok = true,
            payloads = listOf(Payload("tree", "application/json", byteArrayOf(1, 2)), Payload("screenshot", "image/png", byteArrayOf(3))),
        )
        val payloads = JSONObject(response.header()).getJSONArray("payloads")
        assertEquals("tree", payloads.getJSONObject(0).getString("name"))
        assertEquals(2, payloads.getJSONObject(0).getInt("bytes"))
        assertEquals("image/png", payloads.getJSONObject(1).getString("type"))
    }

    @Test
    fun writeSendsTheHeaderLineThenRawBytes() {
        val out = ByteArrayOutputStream()
        Frames.write(out, Response(ok = true, payloads = listOf(Payload("p", "application/octet-stream", byteArrayOf(7, 8)))))
        val bytes = out.toByteArray()
        val newline = bytes.indexOf('\n'.code.toByte())
        assertTrue(JSONObject(String(bytes, 0, newline, Charsets.UTF_8)).getBoolean("ok"))
        assertEquals(listOf<Byte>(7, 8), bytes.drop(newline + 1))
    }

    @Test
    fun failuresCarryAMessageAndNoPayloads() {
        val header = JSONObject(Response.failure("No window").header())
        assertFalse(header.getBoolean("ok"))
        assertEquals("No window", header.getString("error"))
        assertFalse(header.has("payloads"))
    }

    @Test
    fun readLineReadsUtf8LinesThenNull() {
        val input = ByteArrayInputStream("{\"cmd\":\"hello\"}\nPrishtinë\nlast".toByteArray(Charsets.UTF_8))
        assertEquals("{\"cmd\":\"hello\"}", Frames.readLine(input))
        assertEquals("Prishtinë", Frames.readLine(input))
        assertEquals("last", Frames.readLine(input))
        assertNull(Frames.readLine(input))
    }

    @Test(expected = IOException::class)
    fun readLineRejectsOversizedRequests() {
        Frames.readLine(ByteArrayInputStream(ByteArray(70_000) { 'a'.code.toByte() }))
    }
}

class RequestHandlerTest {
    private val capturer = FakeCapturer()
    private val handler = RequestHandler(capturer, "0.0.1")

    @Test
    fun helloReportsVersionProtocolAndDevice() {
        val data = handler.handle("""{"cmd":"hello"}""").data!!
        assertEquals("0.0.1", data.getString("agentVersion"))
        assertEquals(PROTOCOL_VERSION, data.getInt("protocol"))
        assertEquals(36, data.getJSONObject("device").getInt("sdkInt"))
    }

    @Test
    fun captureReturnsTheTreeAndScreenshotPayloads() {
        val response = handler.handle("""{"cmd":"capture","packageName":"com.example.shop","timeoutMs":5000}""")
        assertTrue(response.ok)
        assertEquals(listOf("tree", "screenshot"), response.payloads.map { it.name })
        val tree = JSONObject(String(response.payloads[0].bytes, Charsets.UTF_8))
        assertEquals("Hi", tree.getJSONObject("root").getString("text"))
        assertEquals(listOf<Byte>(9, 8, 7), response.payloads[1].bytes.toList())
        assertEquals("com.example.shop", capturer.lastPackage)
        assertEquals(5_000L, capturer.lastTimeout)
    }

    @Test
    fun captureClampsTheTimeoutAndTreatsAMissingPackageAsAny() {
        handler.handle("""{"cmd":"capture","timeoutMs":999999999}""")
        assertNull(capturer.lastPackage)
        assertEquals(120_000L, capturer.lastTimeout)
    }

    @Test
    fun captureProblemsBecomeReadableFailures() {
        val response = RequestHandler(FakeCapturer("App did not start"), "0.0.1").handle("""{"cmd":"capture"}""")
        assertFalse(response.ok)
        assertEquals("App did not start", response.error)
    }

    @Test
    fun shutdownStopsTheServer() {
        assertTrue(handler.handle("""{"cmd":"shutdown"}""").shutdown)
    }

    @Test
    fun unknownCommandsAndBadJsonAreRejected() {
        assertEquals("Unknown command \"dance\". Expected hello, capture or shutdown.", handler.handle("""{"cmd":"dance"}""").error)
        assertTrue(handler.handle("not json").error!!.startsWith("The request is not valid JSON"))
    }
}

class PeerTest {
    @Test
    fun onlyAdbAndRootAreTrusted() {
        assertTrue(isTrustedPeer(2000))
        assertTrue(isTrustedPeer(0))
        assertFalse(isTrustedPeer(10_123))
    }
}

class IdleTimerTest {
    @Test
    fun expiresOnlyAfterTheTimeoutWithoutActivity() {
        var now = 1_000L
        val timer = IdleTimer(timeoutMs = 500) { now }
        now += 499
        assertFalse(timer.isExpired())
        timer.touch()
        now += 499
        assertFalse(timer.isExpired())
        now += 1
        assertTrue(timer.isExpired())
    }
}
