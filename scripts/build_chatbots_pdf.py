from pathlib import Path
import html
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, HRFlowable, PageBreak, PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "CHATBOTS_COMERCIALES.md"
OUTPUT = ROOT / "docs" / "CHATBOTS COMERCIALES.pdf"


def safe_inline(value):
    value = html.escape(value, quote=False)
    value = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    return value


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=27, leading=33, alignment=TA_CENTER, textColor=colors.HexColor("#24124d"), spaceAfter=10 * mm))
styles.add(ParagraphStyle(name="CoverSubtitle", parent=styles["Normal"], fontSize=12, leading=17, alignment=TA_CENTER, textColor=colors.HexColor("#625b72"), spaceAfter=8 * mm))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#3f1d81"), spaceBefore=7 * mm, spaceAfter=4 * mm))
styles.add(ParagraphStyle(name="Subsection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#24124d"), spaceBefore=4 * mm, spaceAfter=2 * mm))
styles.add(ParagraphStyle(name="BodySmall", parent=styles["BodyText"], fontSize=9.2, leading=13, spaceAfter=2.2 * mm))
styles.add(ParagraphStyle(name="BulletSmall", parent=styles["BodyText"], fontSize=9.2, leading=13, leftIndent=6 * mm, firstLineIndent=-3 * mm, bulletIndent=1 * mm, spaceAfter=1.2 * mm))
styles.add(ParagraphStyle(name="TableSmall", parent=styles["BodyText"], fontSize=7.3, leading=9.2))
styles.add(ParagraphStyle(name="CodeSmall", parent=styles["Code"], fontName="Courier", fontSize=7.1, leading=9.2, leftIndent=4 * mm, rightIndent=4 * mm, backColor=colors.HexColor("#f4f1f8"), borderColor=colors.HexColor("#ddd5ed"), borderWidth=0.5, borderPadding=5))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d9d4e8"))
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#666276"))
    canvas.drawString(18 * mm, 9 * mm, "CHATBOTS COMERCIALES")
    canvas.drawRightString(192 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def table_rows(lines, start):
    rows = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
        if not cells or not all(re.fullmatch(r"[-: ]+", cell) for cell in cells):
            rows.append([Paragraph(safe_inline(cell), styles["TableSmall"]) for cell in cells])
        index += 1
    return rows, index


def build():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=16 * mm, bottomMargin=19 * mm, title="CHATBOTS COMERCIALES", author="ERP Comercial")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=footer)])
    story = [
        Spacer(1, 24 * mm),
        Paragraph("CHATBOTS COMERCIALES", styles["CoverTitle"]),
        Paragraph("Guia tecnica para crear, integrar y replicar agentes comerciales con Google ADK", styles["CoverSubtitle"]),
        HRFlowable(width="70%", thickness=2, color=colors.HexColor("#6c35d9"), spaceAfter=10 * mm),
        Paragraph("ERP omnicanal, CRM y agente comercial", styles["CoverSubtitle"]),
        Spacer(1, 20 * mm),
        Paragraph("Version 1.0 | 2026-08-08", styles["CoverSubtitle"]),
        PageBreak(),
    ]
    index = 0
    in_code = False
    code = []
    while index < len(lines):
        raw = lines[index]
        line = raw.strip()
        if line.startswith("```"):
            if in_code:
                story.append(Preformatted("\n".join(code), styles["CodeSmall"]))
                story.append(Spacer(1, 2 * mm))
                code = []
                in_code = False
            else:
                in_code = True
            index += 1
            continue
        if in_code:
            code.append(raw)
            index += 1
            continue
        if not line:
            index += 1
            continue
        if line == "---":
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#ddd5ed"), spaceBefore=2 * mm, spaceAfter=2 * mm))
            index += 1
            continue
        if line.startswith("# "):
            index += 1
            continue
        if line.startswith("## "):
            story.append(Paragraph(safe_inline(line[3:]), styles["Section"]))
            index += 1
            continue
        if line.startswith("### "):
            story.append(Paragraph(safe_inline(line[4:]), styles["Subsection"]))
            index += 1
            continue
        if line.startswith("|"):
            rows, index = table_rows(lines, index)
            if rows:
                widths = [doc.width / len(rows[0])] * len(rows[0])
                table = Table(rows, colWidths=widths, repeatRows=1)
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3f1d81")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d8d1e5")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#faf9fc")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.extend([table, Spacer(1, 3 * mm)])
            continue
        if line.startswith("- "):
            story.append(Paragraph(safe_inline(line[2:]), styles["BulletSmall"], bulletText="•"))
            index += 1
            continue
        if re.match(r"^\d+\. ", line):
            story.append(Paragraph(safe_inline(re.sub(r"^\d+\. ", "", line)), styles["BulletSmall"], bulletText="•"))
            index += 1
            continue
        story.append(Paragraph(safe_inline(line), styles["BodySmall"]))
        index += 1
    doc.build(story)
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    build()
