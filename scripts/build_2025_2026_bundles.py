#!/usr/bin/env python3
"""
One-off: assembles final bundle.json for the 2025 and 2026 combined papers,
merging the auto-extracted clean questions (output/pyq_questions.json) with
the manually-resolved review items (transcribed by reading the rendered PDF
pages directly — see conversation for the vision-transcription pass).

Same final blocks shape as the 2020/2024 bundles, consumed by
import_pyq_paper.py unchanged.
"""

import json
import shutil
from pathlib import Path

OUT_DIR = Path("output/manual_2025_2026")
IMAGES_DIR = OUT_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

REVIEW_ASSETS = Path("output/review_assets_pyq")

img_counter = [0]


def copy_image(local_path: str, prefix: str) -> str:
    src = Path(local_path)
    img_counter[0] += 1
    dest_name = f"{prefix}_{img_counter[0]}{src.suffix}"
    shutil.copy(src, IMAGES_DIR / dest_name)
    return f"images/{dest_name}"


def text_options(strings: list) -> dict:
    return {"type": "options", "values": [{"type": "text", "content": s} for s in strings]}


def image_option(path: str, prefix: str) -> dict:
    return {"type": "image", "path": copy_image(path, prefix)}


def convert_flat_question(q: dict) -> dict:
    blocks = [{"type": "text", "content": q["question"]}]
    if q.get("imageLocalPath"):
        blocks.append({"type": "image", "path": copy_image(q["imageLocalPath"], q["subject"].lower())})
    if q["questionType"] == "numeric":
        answer = {"type": "NAT", "correctValue": q["answer"]}
    else:
        opts = q["options"]
        opt_images = q.get("optionImageLocalPaths", {})
        values = []
        for letter in "ABCD":
            if opt_images.get(letter):
                values.append({"type": "image", "path": copy_image(opt_images[letter], f"{q['subject'].lower()}_opt")})
            else:
                values.append({"type": "text", "content": opts.get(letter, "")})
        blocks.append({"type": "options", "values": values})
        answer = {"type": "MCQ", "correctOption": q["answer"], "correctIndex": "ABCD".index(q["answer"])}
    return {"subject": q["subject"].lower(), "blocks": blocks, "answer": answer}


R2025 = "JEE_Main_2025_April_2_Shift_1_Question_Paper_and_Solutions_PDF___Vedantu"
R2026 = "JEE_Main_2026_April_8_Shift_2_Question_Paper_with_Answer_Key__Solutions_PDF__and_Analysis"


def p2025(name):
    return str(REVIEW_ASSETS / R2025 / name)


def p2026(name):
    return str(REVIEW_ASSETS / R2026 / name)


# Manually-resolved questions. "page" is approximate source-page (0-based),
# used only to sort within-subject alongside the auto-extracted ones.
RESOLVED_2025 = [
    {"page": 0, "subject": "physics", "blocks": [
        {"type": "text", "content": "The wavefront of a wave is $x + y + z = \\text{const}$. Find the angle which the direction of wave propagation makes with the x-axis."},
        text_options(["$\\cos^{-1}\\left(\\frac{1}{\\sqrt3}\\right)$", "$\\cos^{-1}\\left(\\frac{1}{2\\sqrt3}\\right)$", "$\\cos^{-1}\\left(\\frac{1}{\\sqrt2}\\right)$", "$\\cos^{-1}\\left(\\frac12\\right)$"]),
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 1, "subject": "physics", "blocks": [
        {"type": "text", "content": "A square shape lamina of mass M kg is at rest. Find the value of F (in N)."},
        image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q2_cand1_p1_x109.png"), "phys2025"),
        text_options(["10 N", "15 N", "20 N", "30 N"]),
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 1, "subject": "physics", "blocks": [
        {"type": "text", "content": "The figure shows an infinite plane having uniform charge density $\\sigma$ and a small charged particle of charge $q$ and mass $m$ suspended by a light insulating thread. Find $\\sigma$ if the charge is in equilibrium."},
        image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q3_cand0_p1_x111.png"), "phys2025"),
        text_options(["$\\dfrac{2\\varepsilon_0 mg}{q}$", "$\\dfrac{\\varepsilon_0 mg}{2q}$", "$\\dfrac{2q}{\\varepsilon_0 mg}$", "$\\dfrac{2q\\varepsilon_0}{mg}$"]),
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 2, "subject": "physics", "blocks": [
        {"type": "text", "content": "Find the ratio of magnetic field at the centre of a circular coil to that at a distance of $\\frac{3R}{4}$ from the centre on the axis of the coil."},
        text_options(["64/125", "125/64", "8/5", "5/8"]),
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},

    {"page": 3, "subject": "physics", "blocks": [
        {"type": "text", "content": "A current carrying wire is in the form of a circle of radius R. Find the ratio of magnetic field at the centre to the magnetic field at an axial point at a distance R from its centre."},
        text_options(["2", "$2\\sqrt2$", "$\\sqrt3$", "$1/\\sqrt2$"]),
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},

    {"page": 3, "subject": "physics", "blocks": [
        {"type": "text", "content": "There is a metal plate with work function $\\Phi$; a photon of frequency $\\nu$ is incident on it. An electron is ejected normally from point A with maximum kinetic energy, and a magnetic field perpendicular to the initial velocity and parallel to the metallic plate exists throughout the path. The electron strikes the plate at B. Find the distance between points A and B."},
        text_options(["$\\dfrac{h\\nu-\\phi}{eB}$", "$\\dfrac{\\sqrt{2m(h\\nu-\\phi)}}{eB}$", "$\\dfrac{2\\sqrt{2m(h\\nu-\\phi)}}{eB}$", "$\\dfrac{m(h\\nu-\\phi)}{eB}$"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 5, "subject": "physics", "blocks": [
        {"type": "text", "content": "The figure shows an electric circuit with a Zener diode with $V_z = 30V$; find the current through the diode in mA."},
        image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q7_cand0_p5_x430.png"), "phys2025"),
        text_options(["6 mA", "150 mA", "144 mA", "154 mA"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 5, "subject": "physics", "blocks": [
        {"type": "text", "content": "In a single slit diffraction using light of wavelength $\\lambda$, the 2nd minima is formed at $\\theta_1$ and 3rd maxima is at $\\theta_2$. If $\\theta_1+\\theta_2=30°$, then the slit width is"},
        text_options(["$66\\lambda/\\pi$", "$22\\lambda/\\pi$", "$33\\lambda/\\pi$", "$11\\lambda/\\pi$"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 6, "subject": "physics", "blocks": [
        {"type": "text", "content": "Two uniformly charged sheets are shown in the figure. Find the net force on the charge Q placed symmetrically between the plates."},
        image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q9_cand0_p6_x494.png"), "phys2025"),
        text_options(["$3\\sigma Q/\\varepsilon_0$", "$2\\sigma Q/\\varepsilon_0$", "$\\frac32\\sigma Q/\\varepsilon_0$", "Zero"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 8, "subject": "chemistry", "blocks": [
        {"type": "text", "content": "Which of the following molecules hydrolyses fast?"},
        {"type": "options", "values": [
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q10_cand1_p8_x568.png"), "chem2025"),
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q10_cand2_p8_x570.png"), "chem2025"),
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q10_cand3_p9_x650.png"), "chem2025"),
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q10_cand4_p9_x652.png"), "chem2025"),
        ]},
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 9, "subject": "chemistry", "blocks": [
        {"type": "text", "content": "Which of the following is antiaromatic?"},
        {"type": "options", "values": [
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q11_cand1_p9_x654.png"), "chem2025"),
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q11_cand2_p9_x656.png"), "chem2025"),
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q11_cand3_p9_x658.png"), "chem2025"),
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q11_cand4_p10_x705.png"), "chem2025"),
        ]},
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},

    {"page": 10, "subject": "chemistry", "blocks": [
        {"type": "text", "content": "In the following reaction sequence, product C is:"},
        image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q12_cand1_p10_x707.png"), "chem2025"),
        {"type": "text", "content": "But-2-ene + Br$_2$. Identify C."},
        {"type": "options", "values": [
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q12_cand2_p10_x709.png"), "chem2025"),
            {"type": "text", "content": "CH$_3$-CH$_2$-CH$_2$-CHO"},
            {"type": "text", "content": "CH$_3$-CH$_2$-CH$_2$-CH$_2$-OH"},
            image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q12_cand3_p10_x711.png"), "chem2025"),
        ]},
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 11, "subject": "chemistry", "blocks": [
        {"type": "text", "content": "Which of the following carbon atoms forms the least stable and most stable free radical, respectively?"},
        image_option(p2025("2025_JEEMain2025April2Shift1QuestionPaperandSolutionsPDFVedantu_q13_cand1_p11_x766.png"), "chem2025"),
        text_options(["1, 3", "1, 4", "1, 2", "3, 4"]),
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 15, "subject": "mathematics", "blocks": [
        {"type": "text", "content": "If a twice differentiable function $f$ satisfies $f'(x) = f(x)$ such that $f(0) = \\frac12 f'(0)$, then find $f\\left(\\frac{\\pi}{3}\\right)$."},
        text_options(["$e^{\\pi/3}$", "$e^{\\pi/3}/2$", "$\\sqrt3/2$", "$e^{2\\pi/3}/2$"]),
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},
]

RESOLVED_2026 = [
    {"page": 0, "subject": "physics", "blocks": [
        {"type": "text", "content": "For the logic gate shown in the diagram, find the output Y for the given inputs A and B."},
        image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q1_cand1_p0_x16.png"), "phys2026"),
        text_options(["$A.\\overline{B}$", "$\\overline{A}+\\overline{B}$", "$\\overline{A+B}$", "$\\overline{A}.\\overline{B}$"]),
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},

    {"page": 0, "subject": "physics", "blocks": [
        {"type": "text", "content": "Two photons of wavelength $\\lambda_1$ and $\\lambda_2$ ($\\lambda_1 = 2\\lambda_2 = 2\\lambda$) use photoelectric effect on a metal surface, emitting two photoelectrons of kinetic energies $K_1$ and $K_2$ respectively. Find the work function of the metal ($K_1 = 3K_2 = 3K$)."},
        text_options(["$6hc/\\lambda$", "$5hc/4\\lambda$", "$hc/2\\lambda$", "$4hc/3\\lambda$"]),
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},

    {"page": 1, "subject": "physics", "blocks": [
        {"type": "text", "content": "Two objects (1) and (2) travel 104 m and 120 m respectively in the 50th second, with initial speeds of 5 m/s and 12 m/s respectively. Their masses are 3 kg and 2.5 kg. The ratio of momentum of object (1) to object (2) at t = 50 s is nearly:"},
        image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q3_cand1_p1_x117.png"), "phys2026"),
        text_options(["2", "4", "1", "3"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 2, "subject": "physics", "blocks": [
        {"type": "text", "content": "Initial pressure and volume of a monoatomic gas are P and V. It is expanded adiabatically to 27 times its initial volume. Find the magnitude of change in internal energy."},
        text_options(["$\\frac32 PV$", "$PV$", "$\\frac43 PV$", "$PV/2$"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 3, "subject": "physics", "blocks": [
        {"type": "text", "content": "The direction (vector) of incident and refracted light are shown in the diagram. Find the value of C."},
        image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q5_cand1_p3_x235.png"), "phys2026"),
        text_options(["$24/\\sqrt{101}$", "$24/7$", "3", "$25/\\sqrt{101}$"]),
    ], "answer": {"type": "MCQ", "correctOption": "A", "correctIndex": 0}},

    {"page": 6, "subject": "chemistry", "blocks": [
        {"type": "text", "content": "Given below are two statements.\nStatement-I: Boiling point follows the order CH$_3$CH$_2$CH$_2$I > CH$_3$CH$_2$I > CH$_3$I."},
        image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q6_cand1_p6_x472.png"), "chem2026"),
        {"type": "text", "content": "Statement-II: Melting point order is as shown:"},
        image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q6_cand2_p6_x474.png"), "chem2026"),
        {"type": "text", "content": "Choose the correct statement."},
        text_options(["Both Statement-I and Statement-II are correct", "Statement-I is correct but Statement-II is incorrect", "Statement-I is incorrect but Statement-II is correct", "Both Statement-I and Statement-II are incorrect"]),
    ], "answer": {"type": "MCQ", "correctOption": "B", "correctIndex": 1}},

    {"page": 8, "subject": "chemistry", "blocks": [
        {"type": "text", "content": "Consider the reaction sequence:"},
        image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q7_cand1_p8_x552.png"), "chem2026"),
        {"type": "text", "content": "Identify P."},
        {"type": "options", "values": [
            image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q7_cand2_p8_x554.png"), "chem2026"),
            {"type": "text", "content": "OHC-(CH2)4-NH-CH2-OH"},
            {"type": "text", "content": "HO2C-(CH2)4-NH-CH-CH2-OH"},
            image_option(p2026("2026_JEEMain2026April8Shift2QuestionPaperwithAnswerKeySolutionsPDFandAnalysis_q7_cand3_p8_x558.png"), "chem2026"),
        ]},
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},

    {"page": 13, "subject": "mathematics", "blocks": [
        {"type": "text", "content": "If $\\left(x\\sqrt{1-x^2}\\right)dy - \\left(y\\sqrt{1-x^2} - x^2\\cos^{-1}x\\right)dx = 0$ and $\\displaystyle\\lim_{x\\to1^-}y(x)=1$, then $y\\left(\\frac12\\right)$ is"},
        text_options(["$\\pi^2/36$", "$\\pi/36 + 1/2$", "$\\pi^2/36 + 1/2$", "$\\pi/36$"]),
    ], "answer": {"type": "MCQ", "correctOption": "C", "correctIndex": 2}},
]


def build(year_label, clean_chapter, resolved, out_name):
    # Clean (auto-extracted) questions keep their original relative order;
    # manually-resolved ones are appended at the end of their subject's
    # section (no page metadata on the clean side to interleave precisely —
    # a minor ordering imperfection, but every question is still complete,
    # correctly answered, and in the right subject section).
    all_qs = json.loads(Path("output/pyq_questions.json").read_text(encoding="utf-8"))
    by_subject = {"physics": [], "chemistry": [], "mathematics": []}
    for q in all_qs:
        if q["chapter"] == clean_chapter:
            by_subject[q["subject"].lower()].append(convert_flat_question(q))
    for r in resolved:
        by_subject[r["subject"]].append({"subject": r["subject"], "blocks": r["blocks"], "answer": r["answer"]})

    combined = []
    for subj in ["physics", "chemistry", "mathematics"]:
        combined.extend(by_subject[subj])
        print(f"{year_label} {subj}: {len(by_subject[subj])}")

    bundle = []
    for i, entry in enumerate(combined, 1):
        bundle.append({
            "id": f"jee-main-{out_name}-q{i:03d}",
            "subject": entry["subject"], "questionNo": i,
            "type": entry["answer"]["type"],
            "blocks": entry["blocks"],
            "answer": entry["answer"],
        })
    out_file = OUT_DIR / f"{out_name}_bundle.json"
    out_file.write_text(json.dumps(bundle, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(bundle)} questions to {out_file}\n")


build("2025", "JEE Main 2025 PYQ", RESOLVED_2025, "2025-apr02-s1")
build("2026", "JEE Main 2026 PYQ", RESOLVED_2026, "2026-apr08-s2")
print(f"Total images copied: {img_counter[0]}")
