"""
Generalized Kawasaki — Blender scene and renders.

Builds, for a single vertex with sector angles θ1 … θn, an engineering-style
scene with three parts side by side:

  left    the 3D vertex: rigid triangular panels O–r_i–r_(i+1) whose sector
          angles are exactly θi (r_i · r_(i+1) = cos θi, solved numerically)
  centre  the sector diagram: sectors laid edge to edge with their true
          angles (T = Σθ), odd sectors teal, even sectors amber, the surplus
          or deficit against 360° marked
  right   the angular walk: φ0 = 0, φk = φ(k−1) ± θk, drawn as a spiral;
          S = φn and the winding number S / 360°

and writes renders/case_*.png for the five predefined cases.

Run (from the project folder):
    blender -b -P scripts/generalized_kawasaki.py -- --all
    blender -b -P scripts/generalized_kawasaki.py -- --case C
    blender -b -P scripts/generalized_kawasaki.py -- --theta 120,40,100,60,90,50
    blender    -P scripts/generalized_kawasaki.py -- --case C --no-render   (opens the scene)
Inside Blender's Text Editor: set CASE below and press Run Script.

Honesty rules (same as the web lab):
  * every 3D panel keeps its sector angle exactly (the residual is printed);
  * a six-crease vertex with S = ±360° is FLAT-LOCKED: its rigid panels have
    no non-flat closed shape (closure condition at equality, Kapovich–Millson),
    so no 3D shape is invented — a nearby vertex (the tight sectors reduced by
    ε) is shown instead and labelled as such;
  * the angular walk is the exact flat-folded ray directions; it does not
    verify layer ordering or collisions, and no folding animation is claimed.
"""
import math
import os
import sys

import numpy as np

CASE = "C"  # used when run from Blender's Text Editor without arguments

CASES = {
    "A": ("ordinary flat vertex", [90, 90, 90, 90], "case_A_S0.png"),
    "B": ("saddle, but S = 0", [100, 70, 60, 80, 50, 60], "case_B_saddle_S0.png"),
    "C": ("S = +360 (winding +1)", [130, 10, 130, 10, 130, 10], "case_C_plus360.png"),
    "D": ("S = -360 (winding -1)", [10, 130, 10, 130, 10, 130], "case_D_minus360.png"),
    "E": ("saddle, condition fails", [100, 40, 100, 40, 100, 40], "case_E_invalid.png"),
}
EXPECTED = {"A": (360, 0), "B": (420, 0), "C": (420, 360), "D": (420, -360), "E": (420, 180)}
EPS = 1e-6
D2R = math.pi / 180

# ───────────────────────────────────────────── mathematics (mirrors src/core/analysis/vertexWinding.ts)


def analyze(theta):
    n = len(theta)
    total = float(sum(theta))
    odd = float(sum(theta[0::2]))  # θ1, θ3, … (1-based odd)
    even = float(sum(theta[1::2]))
    phi = [0.0]
    for i, t in enumerate(theta):
        phi.append(phi[-1] + (t if i % 2 == 0 else -t))
    S = odd - even
    winding = None
    for w in (0, 1, -1):
        if abs(S - 360 * w) < EPS:
            winding = w
    intrinsic = "flat" if abs(total - 360) < EPS else ("cone" if total < 360 else "saddle")
    passed = n % 2 == 0 and winding is not None
    return dict(n=n, total=total, defect=360 - total, odd=odd, even=even, S=S, phi=phi, winding=winding, intrinsic=intrinsic, passed=passed)


def closure_margin(theta):
    """min over odd-size subsets I of (|I|-1)*180 - (sum_I - sum_rest); 0 = flat-locked."""
    n, total = len(theta), sum(theta)
    best, subset = math.inf, []
    for mask in range(1, 1 << n):
        idx = [i for i in range(n) if mask >> i & 1]
        if len(idx) % 2 == 0:
            continue
        s_in = sum(theta[i] for i in idx)
        m = (len(idx) - 1) * 180 - (s_in - (total - s_in))
        if m < best:
            best, subset = m, [i + 1 for i in idx]
    return best, subset


def project(x, cos_t, iters=200, tol=1e-13):
    """Minimum-norm Gauss–Newton onto |r_i| = 1, r_i·r_(i+1) = cos θi."""
    n = len(cos_t)
    x = x.copy()
    res = math.inf
    for _ in range(iters):
        R = x.reshape(n, 3)
        Rn = np.roll(R, -1, axis=0)
        c = np.concatenate([np.sum(R * R, axis=1) - 1, np.sum(R * Rn, axis=1) - cos_t])
        res = float(np.max(np.abs(c)))
        if res < tol:
            break
        J = np.zeros((2 * n, 3 * n))
        for i in range(n):
            j = (i + 1) % n
            J[i, 3 * i:3 * i + 3] = 2 * R[i]
            J[n + i, 3 * i:3 * i + 3] += R[j]
            J[n + i, 3 * j:3 * j + 3] += R[i]
        A = J @ J.T + (1e-12 + 1e-6 * res) * np.eye(2 * n)
        x = x - J.T @ np.linalg.solve(A, c)
    return x, res


def planarity(rays):
    w, v = np.linalg.eigh(rays.T @ rays)
    return float(w[0]), v[:, 0]


def panel_crossings(rays):
    n = len(rays)
    O = np.zeros(3)

    def seg_hits(p, q, tri):
        a, b, c = tri
        nrm = np.cross(b - a, c - a)
        nl = np.linalg.norm(nrm) or 1.0
        dp, dq = np.dot(p - a, nrm) / nl, np.dot(q - a, nrm) / nl
        if abs(dp) < 1e-7 or abs(dq) < 1e-7 or dp * dq > 0:
            return False
        X = p + dp / (dp - dq) * (q - p)
        inside = all(np.dot(np.cross(e - s, X - s), nrm) > 1e-9 for s, e in ((a, b), (b, c), (c, a)))
        return inside and np.linalg.norm(X) > 1e-3

    def edges(t):
        return [(t[1] * 0.02, t[1]), (t[2] * 0.02, t[2]), (t[1], t[2])]

    count = 0
    for i in range(n):
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            A = (O, rays[i], rays[(i + 1) % n])
            B = (O, rays[j], rays[(j + 1) % n])
            if any(seg_hits(p, q, B) for p, q in edges(A)) or any(seg_hits(p, q, A) for p, q in edges(B)):
                count += 1
    return count


def spread_out(rays, cos_t, iters=250):
    """Move along the exact constraint set to make the vertex as clearly non-flat as possible."""
    cur = rays
    lam, nrm = planarity(cur)
    cross = panel_crossings(cur)
    eta = 0.08
    for _ in range(iters):
        if eta < 1e-4:
            break
        step = cur + eta * 2 * np.outer(cur @ nrm, nrm)
        x, res = project(step.ravel(), cos_t)
        if res > 1e-10:
            eta *= 0.5
            continue
        nxt = x.reshape(-1, 3)
        nxt /= np.linalg.norm(nxt, axis=1)[:, None]
        l2, n2 = planarity(nxt)
        if l2 <= lam + 1e-9 or panel_crossings(nxt) > cross:
            eta *= 0.5
            continue
        cur, lam, nrm = nxt, l2, n2
        eta = min(eta * 1.3, 0.3)
    return cur


def flat_rays(theta):
    phi = analyze(theta)["phi"]
    return np.array([[math.cos(phi[k] * D2R), math.sin(phi[k] * D2R), 0.0] for k in range(len(theta))])


def solve3d(theta):
    """Returns (rays, info) — info: 'flat' | 'locked' | 'none' | 'open', residual, crossings."""
    theta = list(map(float, theta))
    n, T = len(theta), sum(theta)
    cos_t = np.cos(np.array(theta) * D2R)
    if abs(T - 360) < EPS:
        acc, rays = 0.0, []
        for t in theta:
            rays.append([math.cos(acc * D2R), math.sin(acc * D2R), 0.0])
            acc += t
        return np.array(rays), "flat"
    margin, _ = closure_margin(theta)
    if margin < -EPS:
        return flat_rays(theta), "none"
    if margin < 1e-6:
        return flat_rays(theta), "locked"
    rng = np.random.default_rng(12345)
    guesses = []
    for tilt in (25, 40, 15, 55):
        acc, g = 0.0, []
        for i, t in enumerate(theta):
            psi = acc * 360 / T * D2R
            acc += t
            beta = (90 - tilt if T < 360 else 90 + (tilt if i % 2 == 0 else -tilt)) * D2R
            g.append([math.sin(beta) * math.cos(psi), math.sin(beta) * math.sin(psi), math.cos(beta)])
        guesses.append(np.array(g))
    for _ in range(48):
        z = rng.uniform(-1, 1, n)
        p = rng.uniform(0, 2 * math.pi, n)
        r = np.sqrt(1 - z * z)
        guesses.append(np.stack([r * np.cos(p), r * np.sin(p), z], axis=1))
    best, best_key = None, (math.inf, -math.inf)
    for g in guesses:
        x, res = project(g.ravel(), cos_t)
        if res > 1e-10:
            continue
        shape = x.reshape(-1, 3)
        shape /= np.linalg.norm(shape, axis=1)[:, None]
        shape = spread_out(shape, cos_t)
        key = (panel_crossings(shape), planarity(shape)[0])
        if key[1] < 1e-7:
            continue
        if key[0] < best_key[0] or (key[0] == best_key[0] and key[1] > best_key[1]):
            best, best_key = shape, key
        if best_key[0] == 0 and best_key[1] > 0.12:
            break
    return best, "open"


def residual(rays, theta):
    n = len(theta)
    out = 0.0
    for i in range(n):
        out = max(out, abs(np.dot(rays[i], rays[i]) - 1), abs(np.dot(rays[i], rays[(i + 1) % n]) - math.cos(theta[i] * D2R)))
    return out


def validate():
    """Required values of the five predefined cases (exit code 1 on mismatch)."""
    ok = True
    print("case  T        O        E        S         winding  pass   3D")
    for cid, (_, theta, _) in CASES.items():
        r = analyze(theta)
        T, S = EXPECTED[cid]
        good = abs(r["total"] - T) < 1e-9 and abs(r["S"] - S) < 1e-9
        rays, kind = solve3d(theta)
        res = residual(rays, theta) if rays is not None else math.inf
        ok = ok and good and res < 1e-9
        w = "—" if r["winding"] is None else ("0" if r["winding"] == 0 else f"{r['winding']:+d}")
        print(f"{cid}     {r['total']:7.1f}  {r['odd']:7.1f}  {r['even']:7.1f}  {r['S']:+8.1f}  {w:>7}  {str(r['passed']):5}  {kind} (residual {res:.1e})  {'OK' if good else 'MISMATCH'}")
    return ok


# ───────────────────────────────────────────── Blender scene

ODD = (0.055, 0.455, 0.565, 1)  # #0e7490 teal
EVEN = (0.639, 0.329, 0.110, 1)  # #a3541c amber
INK = (0.09, 0.125, 0.165, 1)
GRID = (0.80, 0.84, 0.86, 1)
GOOD = (0.11, 0.45, 0.28, 1)
BAD = (0.78, 0.21, 0.17, 1)


def build_scene(bpy, theta, title, cid=None, eps=6.0):
    from mathutils import Vector, Euler

    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for b in list(coll):
            coll.remove(b)
    scene = bpy.context.scene
    font_path = next((p for p in ("C:/Windows/Fonts/segoeui.ttf", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") if os.path.exists(p)), None)
    font = bpy.data.fonts.load(font_path) if font_path else None

    def mat(name, rgba, alpha=1.0):
        m = bpy.data.materials.new(name)
        m.diffuse_color = (rgba[0], rgba[1], rgba[2], alpha)
        return m

    m_odd, m_even, m_ink, m_grid = mat("odd", ODD, 0.85), mat("even", EVEN, 0.85), mat("ink", INK), mat("grid", GRID)
    m_good, m_bad = mat("good", GOOD), mat("bad", BAD)

    def mesh(name, verts, faces, material, loc=(0, 0, 0), rot=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in verts], [], faces)
        me.update()
        ob = bpy.data.objects.new(name, me)
        ob.data.materials.append(material)
        ob.location, ob.rotation_euler = loc, rot
        scene.collection.objects.link(ob)
        return ob

    def polyline(name, pts, material, width=0.02, loc=(0, 0, 0), rot=(0, 0, 0)):
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = width
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, q in zip(sp.points, pts):
            p.co = (q[0], q[1], q[2], 1)
        ob = bpy.data.objects.new(name, cu)
        ob.data.materials.append(material)
        ob.location, ob.rotation_euler = loc, rot
        scene.collection.objects.link(ob)
        return ob

    def text(body, loc, size=0.28, material=m_ink, align="CENTER"):
        cu = bpy.data.curves.new("txt", "FONT")
        cu.body = body
        if font:
            cu.font = font
        cu.size = size
        cu.align_x = align
        ob = bpy.data.objects.new("txt", cu)
        ob.data.materials.append(material)
        ob.location = loc
        ob.rotation_euler = (math.pi / 2, 0, 0)  # face the camera (looking along +Y)
        scene.collection.objects.link(ob)
        return ob

    r = analyze(theta)
    n = len(theta)

    # ── left: 3D vertex
    rays, kind = solve3d(theta)
    shown_theta, note = theta, ""
    if kind == "locked":
        margin, subset = closure_margin(theta)
        shown_theta = [t - eps if (i + 1) in subset else t for i, t in enumerate(theta)]
        rays, _ = solve3d(shown_theta)
        note = f"flat-locked: rigid panels cannot open in 3D.\nshown: nearby vertex, theta{subset} - {eps:g} deg\n(S' = {analyze(shown_theta)['S']:+.0f} deg); as eps -> 0 it flattens into the winding"
    elif kind == "none":
        note = "these panels cannot close at all"
    res3d = residual(rays, shown_theta)
    left = Vector((-4.6, 0, 0.1))
    scale = 1.55
    tilt = Euler((math.radians(-62), 0, math.radians(18)))
    for i in range(n):
        a, b = rays[i], rays[(i + 1) % n]
        ang = math.acos(max(-1, min(1, float(np.dot(a, b)))))
        steps = max(2, int(math.ceil(math.degrees(ang) / 6)))
        verts, faces = [(0, 0, 0)], []
        for k in range(steps + 1):
            s = k / steps
            p = (math.sin((1 - s) * ang) * a + math.sin(s * ang) * b) / math.sin(ang) if ang > 1e-9 else a
            verts.append(tuple(p * scale))
        for k in range(steps):
            faces.append((0, k + 1, k + 2))
        mesh(f"panel{i + 1}", verts, faces, m_odd if i % 2 == 0 else m_even, loc=left, rot=tilt)
    for i in range(n):
        polyline(f"crease{i + 1}", [(0, 0, 0), tuple(rays[i] * scale)], m_ink, 0.012, loc=left, rot=tilt)
    for i in range(n):
        mid = rays[i] + rays[(i + 1) % n]
        if np.linalg.norm(mid) < 1e-6:
            mid = np.array([-rays[i][1], rays[i][0], 0.0])
        p = Vector(mid / np.linalg.norm(mid) * scale * 0.62)
        p.rotate(tilt)
        text(f"θ{i + 1}", left + p + Vector((0, -2.5, 0)), 0.24, m_ink)
    text("3D vertex (exact rigid panels)", left + Vector((0, 0, 2.15)), 0.24)
    text(f"T = {r['total']:.0f}°  ({'flat sheet' if r['intrinsic'] == 'flat' else 'cone' if r['intrinsic'] == 'cone' else 'saddle'})\nresidual {res3d:.0e}" + (f"\n{note}" if note else ""), left + Vector((0, 0, -2.1)), 0.17)

    # ── centre: sector diagram (in the XZ plane, facing the camera)
    centre = Vector((0, 0, 0.25))
    acc = 0.0
    for i, t in enumerate(theta):
        R = 1.25 + 0.55 * i / max(1, n - 1)
        steps = max(2, int(math.ceil(t / 4)))
        verts, faces = [(0, 0, 0)], []
        for k in range(steps + 1):
            a = math.radians(acc + t * k / steps)
            verts.append((R * math.cos(a), 0, R * math.sin(a)))
        for k in range(steps):
            faces.append((0, k + 1, k + 2))
        mesh(f"sector{i + 1}", verts, faces, m_odd if i % 2 == 0 else m_even, loc=centre + Vector((0, 0.01 * i, 0)))
        am = math.radians(acc + t / 2)
        lr = R * (0.55 if i % 2 == 0 else 0.82)
        text(f"θ{i + 1}={t:g}°", centre + Vector((lr * math.cos(am), -0.3, lr * math.sin(am) - 0.06)), 0.17, m_ink)
        acc += t
    polyline("zero", [(0, 0, 0), (2.0, 0, 0)], m_ink, 0.01, loc=centre + Vector((0, -0.2, 0)))
    over = r["total"] - 360
    if abs(over) > 1e-6:
        a0, a1 = (360, r["total"]) if over > 0 else (r["total"], 360)
        pts = [(1.95 * math.cos(math.radians(a0 + (a1 - a0) * k / 24)), 0, 1.95 * math.sin(math.radians(a0 + (a1 - a0) * k / 24))) for k in range(25)]
        polyline("surplus", pts, m_bad if over > 0 else m_good, 0.03, loc=centre + Vector((0, -0.2, 0)))
    text("sector angles: odd (teal) / even (amber)", centre + Vector((0, 0, 2.05)), 0.22)
    text(f"O = {' + '.join(f'{t:g}' for t in theta[0::2])} = {r['odd']:g}°\nE = {' + '.join(f'{t:g}' for t in theta[1::2])} = {r['even']:g}°\nS = O − E = {r['S']:+g}°", centre + Vector((0, 0, -2.45)), 0.2)

    # ── right: angular walk
    right = Vector((4.6, 0, 0.25))
    circ = [(1.8 * math.cos(2 * math.pi * k / 96), 0, 1.8 * math.sin(2 * math.pi * k / 96)) for k in range(97)]
    polyline("circle", circ, m_grid, 0.006, loc=right)
    polyline("start", [(0, 0, 0), (1.8, 0, 0)], m_ink, 0.014, loc=right + Vector((0, -0.05, 0)))
    phi = r["phi"]
    r0, dr = 0.45, 1.25 / n
    for k in range(n):
        a0, a1 = phi[k], phi[k + 1]
        steps = max(2, int(math.ceil(abs(a1 - a0) / 3)))
        pts = []
        for j in range(steps + 1):
            u = j / steps
            a = math.radians(a0 + (a1 - a0) * u)
            rr = r0 + dr * (k + u)
            pts.append((rr * math.cos(a), 0, rr * math.sin(a)))
        polyline(f"walk{k + 1}", pts, m_odd if k % 2 == 0 else m_even, 0.03, loc=right + Vector((0, -0.08, 0)))
    end = math.radians(phi[n])
    polyline("end", [(0, 0, 0), (1.8 * math.cos(end), 0, 1.8 * math.sin(end))], m_good if r["passed"] else m_bad, 0.02, loc=right + Vector((0, -0.1, 0)))
    wtxt = f"{r['S'] / 360:.2f} (not an integer)" if r["winding"] is None else ("0" if r["winding"] == 0 else f"{r['winding']:+d}")
    text(f"Winding number = {wtxt}", right + Vector((0, 0, 2.05)), 0.3, m_good if r["passed"] else m_bad)
    seq = " → ".join(f"{p:g}°" for p in phi)
    text(f"angular walk φ: {seq}", right + Vector((0, 0, -2.2)), 0.17)
    text("exact flat-folded ray directions;\ndoes not verify layer order or collision", right + Vector((0, 0, -2.55)), 0.13)

    # ── header
    status = f"GENERALIZED KAWASAKI {'PASS' if r['passed'] else 'FAIL'}   S = {r['S']:+g}°"
    text(f"{'Case ' + cid + ' — ' if cid else ''}{title}   θ = {' / '.join(f'{t:g}' for t in theta)}   Σθ = {r['total']:g}°", Vector((0, 0, 3.15)), 0.3)
    text(status, Vector((0, 0, 2.7)), 0.26, m_good if r["passed"] else m_bad)

    # ── camera, light, look
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = 14.2
    cam_ob = bpy.data.objects.new("cam", cam)
    cam_ob.location = (0, -20, 0.35)
    cam_ob.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(cam_ob)
    scene.camera = cam_ob
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_object_outline = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("world")
    scene.world.color = (0.985, 0.985, 0.975)
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.film_transparent = False
    try:
        scene.view_settings.view_transform = "Standard"
    except Exception:
        pass
    return r


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ok = validate()
    if "--validate-only" in argv:
        sys.exit(0 if ok else 1)
    if not ok:
        print("VALIDATION FAILED")
        sys.exit(1)
    try:
        import bpy  # noqa: F401
    except ImportError:
        print("bpy not available: run inside Blender (blender -b -P scripts/generalized_kawasaki.py -- --all)")
        return
    import bpy

    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "renders")
    os.makedirs(out_dir, exist_ok=True)
    no_render = "--no-render" in argv
    jobs = []
    if "--theta" in argv:
        th = [float(v) for v in argv[argv.index("--theta") + 1].split(",")]
        jobs.append((None, "custom vertex", th, "custom.png"))
    elif "--case" in argv:
        cid = argv[argv.index("--case") + 1].upper()
        jobs.append((cid, CASES[cid][0], CASES[cid][1], CASES[cid][2]))
    elif "--all" in argv or bpy.app.background:
        jobs = [(cid, t, th, f) for cid, (t, th, f) in CASES.items()]
    else:
        jobs.append((CASE, CASES[CASE][0], CASES[CASE][1], CASES[CASE][2]))
    for cid, title, theta, fname in jobs:
        build_scene(bpy, theta, title, cid)
        if not no_render:
            bpy.context.scene.render.filepath = os.path.join(out_dir, fname)
            bpy.ops.render.render(write_still=True)
            print("wrote", os.path.join(out_dir, fname))


if __name__ == "__main__":
    main()
