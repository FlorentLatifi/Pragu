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

class Capture(
    val packageName: String,
    val windowTitle: String?,
    val capturedAt: String,
    val screenWidthPx: Int,
    val screenHeightPx: Int,
    val root: NodeSnapshot,
    val png: ByteArray,
) {
    /** The protocol-1 capture document (AndroidCapture in packages/core/src/android.ts). */
    fun toJson(device: DeviceInfo, agentVersion: String): JSONObject = JSONObject()
        .put("protocol", PROTOCOL_VERSION)
        .put("agentVersion", agentVersion)
        .put("capturedAt", capturedAt)
        .put("packageName", packageName)
        .putNullable("windowTitle", windowTitle)
        .put("screenWidthPx", screenWidthPx)
        .put("screenHeightPx", screenHeightPx)
        .put("device", device.toJson())
        .put("root", root.toJson())
}

/** org.json drops a key when given null; the protocol wants an explicit JSON null instead. */
fun JSONObject.putNullable(key: String, value: Any?): JSONObject = put(key, value ?: JSONObject.NULL)
