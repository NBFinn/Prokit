# Blender per Python (headless)

```bash
blender -b -P modell.py -- --ausgabe teil.stl      # ohne Oberfläche
blender -b datei.blend -P export.py                # bestehende Datei verarbeiten
```
Argumente nach `--` lesen: `sys.argv[sys.argv.index("--") + 1:]`.

## Grundgerüst
```python
import bpy, bmesh, sys, math

bpy.ops.wm.read_factory_settings(use_empty=True)   # leere Szene
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 0.001            # 1 Blender-Einheit = 1 mm
scene.unit_settings.length_unit = "MILLIMETERS"

bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=20, depth=40, location=(0, 0, 20))
obj = bpy.context.active_object

# Modifikatoren nicht-destruktiv aufbauen, vor dem Export anwenden
bevel = obj.modifiers.new("Fase", "BEVEL"); bevel.width = 1.0; bevel.segments = 3
solid = obj.modifiers.new("Wand", "SOLIDIFY"); solid.thickness = 2.0

# Booleans: Schnittobjekt anlegen, Modifier mit solver EXACT
bpy.ops.mesh.primitive_cube_add(size=10, location=(0, 0, 40))
cutter = bpy.context.active_object
boolean = obj.modifiers.new("Schnitt", "BOOLEAN")
boolean.operation = "DIFFERENCE"; boolean.object = cutter; boolean.solver = "EXACT"

bpy.context.view_layer.objects.active = obj
for m in list(obj.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.data.objects.remove(cutter)

# Aufräumen: doppelte Punkte, Normalen nach außen
bm = bmesh.new(); bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(obj.data); bm.free()

# Auf Z = 0 setzen
min_z = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
obj.location.z -= min_z

# Export (Blender ≥ 4.1; ältere: bpy.ops.export_mesh.stl)
bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True)
bpy.ops.wm.stl_export(filepath="teil.stl", export_selected_objects=True, global_scale=1.0)
bpy.ops.export_scene.gltf(filepath="teil.glb", export_format="GLB", use_selection=True)
```

## Organische Formen
- Grundform aus Primitiven + `SUBSURF` (Level 2–3) + `REMESH` (Voxel 0,3–0,5 mm) für ein sauberes, dichtes Druck-Mesh
- Displace-Modifier mit Textur für Oberflächenstruktur
- Für den Druck immer zum Schluss Voxel-Remesh. Das schließt Löcher und vereinigt alles zu einem dichten Teil.

## Vorschau-Rendering (schnell)
```python
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x, scene.render.resolution_y = 1200, 900
cam = bpy.data.objects.new("Kamera", bpy.data.cameras.new("Kamera")); scene.collection.objects.link(cam)
cam.location = (120, -120, 100); cam.rotation_euler = (math.radians(60), 0, math.radians(45)); scene.camera = cam
scene.render.filepath = "//vorschau.png"; bpy.ops.render.render(write_still=True)
```
Für schöne Produktbilder: Engine `CYCLES` (oder `BLENDER_EEVEE_NEXT` ab 4.2), HDRI-Welt, Flächenlicht, Material Principled BSDF mit Rauheit 0,4–0,6.

## Fallstricke
- Maßstab: ohne `scale_length = 0.001` sind 20 Einheiten = 20 m. Der Export schreibt dann je nach Einstellung Meter. Mit `check.mjs` prüfen.
- Modifikatoren werden beim STL-Export nur mit „Apply Modifiers“ berücksichtigt. Darum vorher anwenden.
- Boolean mit `FAST`-Solver erzeugt oft defekte Meshes, deshalb `EXACT` nutzen.
