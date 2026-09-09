@tool
extends Node2D

const MAP_PATH := "res://worldloom-godot-map.json"

func _ready() -> void:
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(1280, 720)), Color("10202a"))
	var font: Font = ThemeDB.fallback_font
	if not FileAccess.file_exists(MAP_PATH):
		draw_string(font, Vector2(40, 56), "Generate a Worldloom map to preview it here.", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color("c9d7e5"))
		return
	var file: FileAccess = FileAccess.open(MAP_PATH, FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		draw_string(font, Vector2(40, 56), "Worldloom map data could not be read.", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color("ffb86c"))
		return
	var map_data: Dictionary = parsed
	var canvas: Dictionary = map_data.get("canvas", {})
	var map_size: Vector2 = Vector2(float(canvas.get("width", 1280)), float(canvas.get("height", 720)))
	var scale_factor: float = minf(1200.0 / maxf(map_size.x, 1.0), 620.0 / maxf(map_size.y, 1.0))
	var origin: Vector2 = Vector2(40, 72)
	draw_rect(Rect2(origin, map_size * scale_factor), Color("172c38"), true)
	draw_rect(Rect2(origin, map_size * scale_factor), Color("4c6f86"), false, 2.0)
	draw_string(font, Vector2(40, 38), "Worldloom generated map", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color("e9f5ff"))
	for element in map_data.get("elements", []):
		if not element is Dictionary:
			continue
		var position: Dictionary = element.get("position", {})
		var point: Vector2 = origin + Vector2(float(position.get("x", 0)), float(position.get("y", 0))) * scale_factor
		draw_circle(point, 14, Color("8dd3c7"))
		draw_circle(point, 14, Color("d8fff6"), false, 2.0)
		var label: String = "%s — %s" % [str(element.get("name", "Element")), str(element.get("description", ""))]
		draw_string(font, point + Vector2(20, 6), label, HORIZONTAL_ALIGNMENT_LEFT, 260, 14, Color("e9f5ff"))
