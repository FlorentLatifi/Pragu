package dev.pragu.agent

import org.json.JSONArray
import org.json.JSONObject

/**
 * One accessibility node, copied out of AccessibilityNodeInfo into plain data so it
 * can be serialised and unit-tested off the device. Field names in [toJson] are the
 * protocol: they must match AndroidRawNode in packages/core/src/android.ts.
 */
data class NodeSnapshot(
    val className: String?,
    val packageName: String?,
    val resourceId: String?,
    val text: String?,
    val contentDescription: String?,
    val hintText: String?,
    /** Text of the element that labels this one: android:labelFor, React Native aria-labelledby. */
    val labeledBy: String?,
    val stateDescription: String?,
    val roleDescription: String?,
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
    val clickable: Boolean,
    val longClickable: Boolean,
    val focusable: Boolean,
    val checkable: Boolean,
    val checked: Boolean,
    val enabled: Boolean,
    val editable: Boolean,
    val visibleToUser: Boolean,
    val importantForAccessibility: Boolean,
    val heading: Boolean,
    val screenReaderFocusable: Boolean,
    val actions: List<Int>,
    val textSizePx: Float?,
    val children: List<NodeSnapshot>,
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.putNullable("className", className)
        json.putNullable("packageName", packageName)
        json.putNullable("resourceId", resourceId)
        json.putNullable("text", text)
        json.putNullable("contentDescription", contentDescription)
        json.putNullable("hintText", hintText)
        json.putNullable("labeledBy", labeledBy)
        json.putNullable("stateDescription", stateDescription)
        json.putNullable("roleDescription", roleDescription)
        json.put("bounds", JSONArray(listOf(left, top, right, bottom)))
        json.put("clickable", clickable)
        json.put("longClickable", longClickable)
        json.put("focusable", focusable)
        json.put("checkable", checkable)
        json.put("checked", checked)
        json.put("enabled", enabled)
        json.put("editable", editable)
        json.put("visibleToUser", visibleToUser)
        json.put("importantForAccessibility", importantForAccessibility)
        json.put("heading", heading)
        json.put("screenReaderFocusable", screenReaderFocusable)
        json.put("actions", JSONArray(actions))
        json.putNullable("textSizePx", textSizePx?.takeIf { it.isFinite() }?.toDouble())
        val childArray = JSONArray()
        children.forEach { childArray.put(it.toJson()) }
        json.put("children", childArray)
        return json
    }

    /** Changes when anything a screen reader would perceive changes; used to wait until the UI settles. */
    fun signature(): Int =
        listOf(className, text, contentDescription, left, top, right, bottom, children.map { it.signature() }).hashCode()

    /** True once the screen shows something a person could read or press, not just empty layout. */
    fun hasContent(): Boolean =
        !text.isNullOrBlank() || !contentDescription.isNullOrBlank() || clickable || children.any { it.hasContent() }

    fun nodeCount(): Int = 1 + children.sumOf { it.nodeCount() }
}

data class DeviceInfo(
    val manufacturer: String,
    val model: String,
    val sdkInt: Int,
    val release: String,
    val densityDpi: Int,
    val fontScale: Float,
    val locale: String,
    val nightMode: Boolean,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("manufacturer", manufacturer)
        .put("model", model)
        .put("sdkInt", sdkInt)
        .put("release", release)
        .put("densityDpi", densityDpi)
        .put("fontScale", fontScale.toDouble())
        .put("locale", locale)
        .put("nightMode", nightMode)
}

/** AccessibilityWindowInfo.TYPE_* values as protocol strings (6, magnification overlay, is API 33+). */
fun windowTypeName(type: Int): String = when (type) {
    1 -> "application"
    2 -> "input_method"
    3 -> "system"
    4 -> "accessibility_overlay"
    5 -> "split_screen_divider"
    6 -> "magnification_overlay"
    else -> "unknown"
}

/**
 * One window on screen: the app, a dialog, the keyboard, the status bar. Only the
 * scanned app's windows carry a tree; other apps and system UI are reported as
 * rectangles, so their content never leaves the device.
 */
data class WindowSnapshot(
    val type: String,
    val layer: Int,
    val title: String?,
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
    val active: Boolean,
    val focused: Boolean,
    val root: NodeSnapshot?,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("type", type)
        .put("layer", layer)
        .putNullable("title", title)
        .put("bounds", JSONArray(listOf(left, top, right, bottom)))
        .put("active", active)
        .put("focused", focused)
        .putNullable("root", root?.toJson())

    fun signature(): Int = listOf(type, layer, left, top, right, bottom, root?.signature()).hashCode()
}

class Capture(
    val packageName: String,
    val windowTitle: String?,
    val capturedAt: String,
    val screenWidthPx: Int,
    val screenHeightPx: Int,
    /** Every window on screen, bottom first. */
    val windows: List<WindowSnapshot>,
    val png: ByteArray,
) {
    fun nodeCount(): Int = windows.sumOf { it.root?.nodeCount() ?: 0 }

    /** The protocol-2 capture document (AndroidCapture in packages/core/src/android.ts). */
    fun toJson(device: DeviceInfo, agentVersion: String): JSONObject {
        val windowArray = JSONArray()
        windows.forEach { windowArray.put(it.toJson()) }
        return JSONObject()
            .put("protocol", PROTOCOL_VERSION)
            .put("agentVersion", agentVersion)
            .put("capturedAt", capturedAt)
            .put("packageName", packageName)
            .putNullable("windowTitle", windowTitle)
            .put("screenWidthPx", screenWidthPx)
            .put("screenHeightPx", screenHeightPx)
            .put("device", device.toJson())
            .put("windows", windowArray)
    }
}

/** org.json drops a key when given null; the protocol wants an explicit JSON null instead. */
fun JSONObject.putNullable(key: String, value: Any?): JSONObject = put(key, value ?: JSONObject.NULL)
