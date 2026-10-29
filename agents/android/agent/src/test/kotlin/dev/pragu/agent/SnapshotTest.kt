package dev.pragu.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

fun snapshot(
    text: String? = null,
    contentDescription: String? = null,
    labeledBy: String? = null,
    clickable: Boolean = false,
    children: List<NodeSnapshot> = emptyList(),
) = NodeSnapshot(
    className = "android.widget.TextView",
    packageName = "com.example.shop",
    resourceId = null,
    text = text,
    contentDescription = contentDescription,
    hintText = null,
    labeledBy = labeledBy,
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
    textCollapsedChars = null,
    children = children,
)

class SnapshotTest {
    // The contract with AndroidRawNode in packages/core/src/android.ts. Changing it means bumping PROTOCOL_VERSION.
    private val protocolKeys = setOf(
        "className", "packageName", "resourceId", "text", "contentDescription", "hintText", "labeledBy",
        "stateDescription", "roleDescription", "bounds", "clickable", "longClickable", "focusable", "checkable", "checked", "enabled",
        "editable", "visibleToUser", "importantForAccessibility", "heading", "screenReaderFocusable", "actions",
        "textSizePx", "textCollapsedChars", "children",
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
        assertTrue(json.isNull("labeledBy"))
    }

    @Test
    fun aFieldCarriesTheWordsOfTheElementThatLabelsIt() {
        assertEquals("Gift card number", snapshot(labeledBy = "Gift card number").toJson().getString("labeledBy"))
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
    fun captureJsonCarriesProtocolDeviceAndWindows() {
        val device = DeviceInfo("Google", "Pixel", 36, "16", 420, 1.0f, "en-US", false)
        val windows = listOf(window("application", 0, snapshot()), window("input_method", 1, null))
        val capture = Capture("com.example.shop", null, "2026-10-27T12:00:00Z", 1080, 2400, windows, byteArrayOf())
        val json = capture.toJson(device, "0.0.2")
        assertEquals(4, PROTOCOL_VERSION)
        assertEquals(PROTOCOL_VERSION, json.getInt("protocol"))
        assertFalse(json.has("root"))
        assertTrue(json.isNull("windowTitle"))
        assertEquals(420, json.getJSONObject("device").getInt("densityDpi"))
        val app = json.getJSONArray("windows").getJSONObject(0)
        assertEquals("android.widget.TextView", app.getJSONObject("root").getString("className"))
        assertTrue(json.getJSONArray("windows").getJSONObject(1).isNull("root"))
        assertEquals(1, capture.nodeCount())
    }

    @Test
    fun windowJsonHasExactlyTheProtocolFields() {
        val json = window("application", 3, snapshot()).toJson()
        assertEquals(setOf("type", "layer", "title", "bounds", "active", "focused", "root"), json.keys().asSequence().toSet())
        assertEquals(3, json.getInt("layer"))
        val bounds = json.getJSONArray("bounds")
        assertEquals(listOf(0, 0, 1080, 2400), (0 until bounds.length()).map { bounds.getInt(it) })
    }

    @Test
    fun windowSignatureFollowsBoundsAndContent() {
        val dialog = window("application", 1, snapshot(text = "Remove?"))
        assertEquals(dialog.signature(), dialog.copy().signature())
        assertNotEquals(dialog.signature(), dialog.copy(bottom = 1200).signature())
        assertNotEquals(dialog.signature(), dialog.copy(root = snapshot(text = "Keep?")).signature())
    }

    @Test
    fun windowTypesMapToProtocolNames() {
        assertEquals(
            listOf("application", "input_method", "system", "accessibility_overlay", "split_screen_divider", "magnification_overlay", "unknown"),
            (1..7).map { windowTypeName(it) },
        )
    }

    private fun window(type: String, layer: Int, root: NodeSnapshot?) =
        WindowSnapshot(type, layer, null, 0, 0, 1080, 2400, active = layer == 0, focused = layer == 0, root = root)
}
