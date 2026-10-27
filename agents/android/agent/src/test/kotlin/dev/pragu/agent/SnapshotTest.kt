package dev.pragu.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

fun snapshot(
    text: String? = null,
    contentDescription: String? = null,
    clickable: Boolean = false,
    children: List<NodeSnapshot> = emptyList(),
) = NodeSnapshot(
    className = "android.widget.TextView",
    packageName = "com.example.shop",
    resourceId = null,
    text = text,
    contentDescription = contentDescription,
    hintText = null,
    stateDescription = null,
    roleDescription = null,
    left = 0,
    top = 10,
    right = 100,
    bottom = 50,
    clickable = clickable,
    longClickable = false,
    focusable = false,
    checkable = false,
    checked = false,
    enabled = true,
    editable = false,
    visibleToUser = true,
    importantForAccessibility = true,
    heading = false,
    screenReaderFocusable = false,
    actions = listOf(16),
    textSizePx = 36.75f,
    children = children,
)

class SnapshotTest {
    // The contract with AndroidRawNode in packages/core/src/android.ts. Changing it means bumping PROTOCOL_VERSION.
    private val protocolKeys = setOf(
        "className", "packageName", "resourceId", "text", "contentDescription", "hintText", "stateDescription",
        "roleDescription", "bounds", "clickable", "longClickable", "focusable", "checkable", "checked", "enabled",
        "editable", "visibleToUser", "importantForAccessibility", "heading", "screenReaderFocusable", "actions",
        "textSizePx", "children",
    )

    @Test
    fun nodeJsonHasExactlyTheProtocolFields() {
        assertEquals(protocolKeys, snapshot().toJson().keys().asSequence().toSet())
    }

    @Test
    fun missingValuesAreExplicitJsonNulls() {
        val json = snapshot(text = "Checkout").toJson()
        assertEquals("Checkout", json.getString("text"))
        assertTrue(json.has("contentDescription"))
        assertTrue(json.isNull("contentDescription"))
    }

    @Test
    fun boundsActionsAndTextSizeAreNumbers() {
        val json = snapshot().toJson()
        val bounds = json.getJSONArray("bounds")
        assertEquals(listOf(0, 10, 100, 50), (0 until bounds.length()).map { bounds.getInt(it) })
        assertEquals(16, json.getJSONArray("actions").getInt(0))
        assertEquals(36.75, json.getDouble("textSizePx"), 0.0001)
    }

    @Test
    fun childrenAreNested() {
        val json = snapshot(children = listOf(snapshot(text = "Apply code"))).toJson()
        assertEquals("Apply code", json.getJSONArray("children").getJSONObject(0).getString("text"))
    }

    @Test
    fun signatureChangesWhenContentChangesAndOnlyThen() {
        val tree = snapshot(children = listOf(snapshot(text = "€14.00")))
        assertEquals(tree.signature(), tree.copy().signature())
        assertNotEquals(tree.signature(), snapshot(children = listOf(snapshot(text = "€22.00"))).signature())
    }

    @Test
    fun hasContentIgnoresEmptyLayout() {
        assertFalse(snapshot(children = listOf(snapshot())).hasContent())
        assertTrue(snapshot(children = listOf(snapshot(contentDescription = "Remove"))).hasContent())
        assertTrue(snapshot(clickable = true).hasContent())
    }

    @Test
    fun nodeCountIncludesDescendants() {
        assertEquals(3, snapshot(children = listOf(snapshot(children = listOf(snapshot())))).nodeCount())
    }

    @Test
    fun captureJsonCarriesProtocolDeviceAndRoot() {
        val device = DeviceInfo("Google", "Pixel", 36, "16", 420, 1.0f, "en-US", false)
        val capture = Capture("com.example.shop", null, "2026-10-27T12:00:00Z", 1080, 2400, snapshot(), byteArrayOf())
        val json = capture.toJson(device, "0.0.1")
        assertEquals(PROTOCOL_VERSION, json.getInt("protocol"))
        assertTrue(json.isNull("windowTitle"))
        assertEquals(420, json.getJSONObject("device").getInt("densityDpi"))
        assertEquals("android.widget.TextView", json.getJSONObject("root").getString("className"))
    }
}
