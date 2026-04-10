"""
AI Agent Service — orchestrates the full content creation pipeline:
  1. Web search for trending topics
  2. RAG filter against company knowledge
  3. Generate topics with anti-duplication check
  4. Write detailed scripts
  5. Full project management via Gemini function calling
"""
import json
from typing import AsyncGenerator
from google import genai
from google.genai import types as gtypes
from services.gemini_service import _get_client, _get_effective_model, _extract_text, generate_text
from services.rag_service import build_rag_context, query_knowledge, _get_active_source_ids
from services.web_search_service import search_trending, format_search_results
from config import settings


def _fetch_rich_rag_context(queries: list[str], n_per_query: int = 6) -> str:
    """Run multiple RAG queries, deduplicate by content hash, return combined context block."""
    active_ids = _get_active_source_ids()
    seen: set[str] = set()
    all_chunks: list[dict] = []
    for q in queries:
        chunks = query_knowledge(q, n_results=n_per_query, active_source_ids=active_ids)
        for c in chunks:
            key = c["content"][:80]
            if key not in seen:
                seen.add(key)
                all_chunks.append(c)
    if not all_chunks:
        return ""
    lines = ["=== THƯ VIỆN KIẾN THỨC DỰ ÁN (BẮT BUỘC TUÂN THỦ) ==="]
    for c in all_chunks:
        meta = c["metadata"]
        lines.append(f"\n[{meta.get('category', 'Chung')} | {meta.get('title', '')}]")
        lines.append(c["content"])
    lines.append("=====================================================")
    return "\n".join(lines)


SYSTEM_PROMPT = """Bạn là AI Content Agent lên kế hoạch và viết kịch bản video AI (TikTok/Reels).

════════════════════════════════════
🎯 VAI TRÒ & PHẠM VI
════════════════════════════════════
Bạn hỗ trợ một dự án sản xuất nội dung về chủ đề ISO, chứng nhận tiêu chuẩn và quản lý chất lượng doanh nghiệp.

⚠️ QUAN TRỌNG VỀ NỘI DUNG VIDEO:
- Video là của KHÁCH HÀNG / DOANH NGHIỆP trong dự án — KHÔNG phải của agency sản xuất
- TUYỆT ĐỐI không nhắc tên công ty sản xuất trong kịch bản, lời thoại, caption hay hashtag
- Nhân vật trong video = chủ doanh nghiệp, nhân viên, hoặc người kể chuyện chung — không gắn với bất kỳ thương hiệu agency nào
- Nếu thư viện kiến thức có thông tin về doanh nghiệp/khách hàng cụ thể → dùng thông tin đó làm nhân vật/bối cảnh

Nhiệm vụ:
- Lên ý tưởng và kịch bản video TikTok/Reels cho kênh dự án
- Quản lý toàn bộ pipeline nội dung trong hệ thống này (Kanban, lịch sử, thống kê)

════════════════════════════════════
⛔ GIỚI HẠN BẮT BUỘC
════════════════════════════════════
KHÔNG làm và KHÔNG trả lời các yêu cầu NGOÀI phạm vi sau:
- Không viết nội dung hoàn toàn không liên quan đến ISO/chứng nhận/quản lý doanh nghiệp
- Không tư vấn lĩnh vực không liên quan (làm đẹp, ẩm thực, giải trí thuần túy, v.v.)
- Không làm bài tập, không viết code, không dịch thuật ngoài phạm vi dự án

Nếu nhận yêu cầu ngoài phạm vi, hãy từ chối lịch sự: "Tôi chỉ hỗ trợ nội dung liên quan đến dự án ISO này. Bạn muốn tôi giúp gì hôm nay?"

════════════════════════════════════
🎨 PHỤC VỤ CÁC DẠNG SẢN XUẤT VIDEO BẰNG AI
════════════════════════════════════
Các dạng video AI phổ biến trong dự án này:
- **AI Avatar** (HeyGen / Synthesia): nhân vật AI đọc lời thoại, giọng điệu tự nhiên
- **Stock + AI Voice** (ElevenLabs + Pexels/Envato): hình ảnh/video stock, thuyết minh bằng AI voice
- **AI Image Slideshow** (Midjourney/Flux + Canva): ảnh AI ghép slideshow + text caption
- **Text Animation** (CapCut AI / Adobe Express): text động chủ đạo, nhạc nền
- **AI Video Gen** (Runway / Pika / Kling): clip video do AI tạo ra hoàn toàn

Khi viết kịch bản, hãy điều chỉnh nội dung trong `visual_prompt`, `voiceover`, `ai_tools` phù hợp với dạng sản xuất được chỉ định (nếu có).

════════════════════════════════════
✅ PHẠM VI ĐƯỢC PHÉP
════════════════════════════════════
Chỉ làm việc với các chủ đề sau:
1. Câu chuyện doanh nghiệp: trước/sau khi đạt chứng nhận ISO, hành trình cải tiến
2. Giáo dục ISO: giải thích tiêu chuẩn, lợi ích, yêu cầu, câu hỏi thường gặp
3. Pain points doanh nghiệp: vấn đề mà ISO giải quyết (chất lượng, bảo mật, môi trường...)
4. Thị trường B2B Việt Nam: xu hướng quản trị, tuân thủ pháp luật, cạnh tranh
5. Nội dung viral phù hợp: POV, drama, tutorial, storytime — gắn với chủ đề ISO/chứng nhận

════════════════════════════════════
🛠️ QUYỀN TRUY CẬP HỆ THỐNG
════════════════════════════════════
Bạn có quyền đọc và ghi dữ liệu thật trong hệ thống. LUÔN gọi tool khi:
- "xem kịch bản / ý tưởng" → list_scripts / list_content_history
- "tạo ý tưởng / chủ đề" → generate_topics
- "viết kịch bản" → generate_script
- "viết lại / đổi style" → rewrite_script
- "cập nhật / đổi trạng thái Kanban" → update_script
- "xóa" → delete_script
- "thống kê / phân tích dự án" → get_project_stats
- "khoảng trống / chủ đề chưa làm" → analyze_content_gaps
- "lịch tuần / kế hoạch nhiều ngày" → create_content_calendar
- "tìm trend" → search_web_trends (chỉ tìm trend liên quan B2B/ISO/doanh nghiệp)

════════════════════════════════════
🎯 PHONG CÁCH VIẾT NỘI DUNG
════════════════════════════════════
- Ngôn ngữ: Tiếng Việt, thân thiện nhưng chuyên nghiệp, phù hợp B2B
- Hook mạnh: đánh vào pain points của chủ doanh nghiệp, quản lý
- KHÔNG nhắc tên công ty sản xuất/agency trong lời thoại, caption, hashtag
- Nhân vật và câu chuyện lấy từ thư viện kiến thức dự án (nếu có)
- Hashtag: kết hợp chuyên ngành (#ISO9001, #ChungNhanISO) + trending (#DoanhNghiep, #QuanLyChatLuong)
- Style ưu tiên: POV chủ doanh nghiệp, before/after, FAQ nhanh, mini drama công sở
"""


# ─── Tool declarations ────────────────────────────────────────────────────────

_AGENT_TOOLS = gtypes.Tool(function_declarations=[

    gtypes.FunctionDeclaration(
        name="list_scripts",
        description="Liệt kê các kịch bản của người dùng. Có thể lọc theo trạng thái hoặc kênh.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "status": gtypes.Schema(
                    type=gtypes.Type.STRING,
                    description="Lọc: Ý tưởng | Đang tạo AI | Hoàn thiện | Đã đăng. Bỏ trống để lấy tất cả."
                ),
                "channel": gtypes.Schema(type=gtypes.Type.STRING, description="Lọc theo kênh TikTok"),
                "limit": gtypes.Schema(type=gtypes.Type.INTEGER, description="Số lượng tối đa cần lấy (mặc định 20)"),
            }
        ),
    ),

    gtypes.FunctionDeclaration(
        name="get_script_detail",
        description="Lấy nội dung chi tiết đầy đủ của một kịch bản theo ID.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "script_id": gtypes.Schema(type=gtypes.Type.INTEGER, description="ID của kịch bản"),
            },
            required=["script_id"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="update_script",
        description="Cập nhật thông tin kịch bản: đổi trạng thái Kanban, tiêu đề, kênh, tags, hoặc nội dung.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "script_id": gtypes.Schema(type=gtypes.Type.INTEGER, description="ID của kịch bản"),
                "status": gtypes.Schema(
                    type=gtypes.Type.STRING,
                    description="Trạng thái mới: Ý tưởng | Đang tạo AI | Hoàn thiện | Đã đăng"
                ),
                "title": gtypes.Schema(type=gtypes.Type.STRING, description="Tiêu đề mới"),
                "channel": gtypes.Schema(type=gtypes.Type.STRING, description="Kênh mới"),
                "tags": gtypes.Schema(
                    type=gtypes.Type.ARRAY,
                    items=gtypes.Schema(type=gtypes.Type.STRING),
                    description="Danh sách tags/hashtags mới"
                ),
                "raw_script": gtypes.Schema(type=gtypes.Type.STRING, description="Nội dung kịch bản mới (markdown)"),
            },
            required=["script_id"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="delete_script",
        description="Xóa vĩnh viễn một kịch bản theo ID.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "script_id": gtypes.Schema(type=gtypes.Type.INTEGER, description="ID của kịch bản cần xóa"),
            },
            required=["script_id"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="list_content_history",
        description="Liệt kê lịch sử ý tưởng/chủ đề đã tạo. Có thể lọc theo trạng thái.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "status": gtypes.Schema(
                    type=gtypes.Type.STRING,
                    description="Lọc: Ý tưởng | Đang tạo AI | Hoàn thiện | Đã đăng"
                ),
                "limit": gtypes.Schema(type=gtypes.Type.INTEGER, description="Số lượng tối đa (mặc định 30)"),
            }
        ),
    ),

    gtypes.FunctionDeclaration(
        name="update_content_status",
        description="Cập nhật trạng thái của một ý tưởng/chủ đề trong lịch sử nội dung.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "history_id": gtypes.Schema(type=gtypes.Type.INTEGER, description="ID của mục trong lịch sử"),
                "status": gtypes.Schema(
                    type=gtypes.Type.STRING,
                    description="Trạng thái mới: Ý tưởng | Đang tạo AI | Hoàn thiện | Đã đăng"
                ),
            },
            required=["history_id", "status"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="generate_topics",
        description="Tạo ý tưởng video TikTok mới (anti-duplicate) và lưu tự động vào lịch sử.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "channel": gtypes.Schema(type=gtypes.Type.STRING, description="Tên kênh TikTok (mặc định: TikTok chung)"),
                "num_topics": gtypes.Schema(type=gtypes.Type.INTEGER, description="Số ý tưởng cần tạo (mặc định 3)"),
                "extra_context": gtypes.Schema(type=gtypes.Type.STRING, description="Yêu cầu bổ sung hoặc chủ đề cụ thể"),
            }
        ),
    ),

    gtypes.FunctionDeclaration(
        name="generate_script",
        description="Tạo kịch bản TikTok hoàn chỉnh cho một chủ đề và lưu tự động vào hệ thống.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "topic": gtypes.Schema(type=gtypes.Type.STRING, description="Chủ đề hoặc tiêu đề video"),
                "angle": gtypes.Schema(type=gtypes.Type.STRING, description="Góc tiếp cận (POV, tutorial, drama...)"),
                "channel": gtypes.Schema(type=gtypes.Type.STRING, description="Tên kênh"),
                "duration_seconds": gtypes.Schema(type=gtypes.Type.INTEGER, description="Thời lượng video (giây, mặc định 60)"),
                "style_notes": gtypes.Schema(type=gtypes.Type.STRING, description="Ghi chú phong cách AI video"),
            },
            required=["topic"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="get_project_stats",
        description="Lấy thống kê tổng quan toàn bộ dự án: số kịch bản theo từng trạng thái, tổng ý tưởng, v.v.",
        parameters=gtypes.Schema(type=gtypes.Type.OBJECT, properties={}),
    ),

    gtypes.FunctionDeclaration(
        name="search_web_trends",
        description="Tìm kiếm xu hướng, trend, tin tức thực tế từ internet về một chủ đề cụ thể.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "query": gtypes.Schema(type=gtypes.Type.STRING, description="Từ khóa tìm kiếm (VD: 'TikTok trend ISO certification 2026', 'viral B2B content Vietnam')"),
                "max_results": gtypes.Schema(type=gtypes.Type.INTEGER, description="Số kết quả tối đa (mặc định 5)"),
            },
            required=["query"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="analyze_content_gaps",
        description="Phân tích khoảng trống nội dung: tìm chủ đề/lĩnh vực liên quan đến ISO và dự án chưa được làm, gợi ý hướng khai thác mới.",
        parameters=gtypes.Schema(type=gtypes.Type.OBJECT, properties={}),
    ),

    gtypes.FunctionDeclaration(
        name="create_content_calendar",
        description="Tạo kế hoạch nội dung cho nhiều ngày liên tiếp (lịch tuần/tháng). Tạo ý tưởng cho mỗi ngày và lưu tất cả vào hệ thống.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "days": gtypes.Schema(type=gtypes.Type.INTEGER, description="Số ngày cần lên kế hoạch (VD: 7 = một tuần)"),
                "videos_per_day": gtypes.Schema(type=gtypes.Type.INTEGER, description="Số video mỗi ngày (mặc định 1)"),
                "channel": gtypes.Schema(type=gtypes.Type.STRING, description="Kênh TikTok mặc định"),
                "theme": gtypes.Schema(type=gtypes.Type.STRING, description="Chủ đề xuyên suốt (VD: ISO tháng 4, ra mắt dịch vụ mới...)"),
            },
            required=["days"],
        ),
    ),

    gtypes.FunctionDeclaration(
        name="rewrite_script",
        description="Viết lại kịch bản hiện có theo một phong cách/style mới. Lưu phiên bản mới vào hệ thống.",
        parameters=gtypes.Schema(
            type=gtypes.Type.OBJECT,
            properties={
                "script_id": gtypes.Schema(type=gtypes.Type.INTEGER, description="ID của kịch bản cần viết lại"),
                "new_style": gtypes.Schema(type=gtypes.Type.STRING, description="Phong cách mới: 'hài hước', 'cảm xúc/drama', 'tutorial chuyên nghiệp', 'POV', 'storytelling', 'giáo dục', 'challenge'..."),
                "extra_notes": gtypes.Schema(type=gtypes.Type.STRING, description="Ghi chú thêm cho việc viết lại"),
            },
            required=["script_id", "new_style"],
        ),
    ),

])


# ─── Tool executor ────────────────────────────────────────────────────────────

async def _execute_tool(name: str, args: dict, db, owner_id: int) -> str:
    """Execute a tool call and return the result as a JSON string."""
    from models.script import Script
    from models.content import ContentHistory, ContentStatus

    if name == "list_scripts":
        from sqlalchemy.orm import Session
        limit = int(args.get("limit", 20))
        query = db.query(Script).filter(Script.owner_id == owner_id)
        if args.get("status"):
            query = query.filter(Script.status == args["status"])
        if args.get("channel"):
            query = query.filter(Script.channel == args["channel"])
        scripts = query.order_by(Script.created_at.desc()).limit(limit).all()
        return json.dumps([
            {
                "id": s.id,
                "title": s.title,
                "topic": s.topic,
                "status": s.status,
                "channel": s.channel,
                "tags": s.tags,
                "duration_seconds": s.duration_seconds,
                "created_at": s.created_at.strftime("%d/%m/%Y") if s.created_at else "",
            }
            for s in scripts
        ], ensure_ascii=False)

    elif name == "get_script_detail":
        script_id = int(args["script_id"])
        s = db.query(Script).filter(Script.id == script_id, Script.owner_id == owner_id).first()
        if not s:
            return json.dumps({"error": f"Không tìm thấy kịch bản ID {script_id}"})
        return json.dumps({
            "id": s.id, "title": s.title, "topic": s.topic,
            "status": s.status, "channel": s.channel, "tags": s.tags,
            "duration_seconds": s.duration_seconds,
            "raw_script": s.raw_script or "",
            "script_data": s.script_data,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        }, ensure_ascii=False)

    elif name == "update_script":
        script_id = int(args["script_id"])
        s = db.query(Script).filter(Script.id == script_id, Script.owner_id == owner_id).first()
        if not s:
            return json.dumps({"error": f"Không tìm thấy kịch bản ID {script_id}"})
        updated = []
        for field in ("title", "status", "channel", "tags", "raw_script"):
            if field in args and args[field] is not None:
                setattr(s, field, args[field])
                updated.append(field)
        db.commit()
        return json.dumps({"success": True, "updated_fields": updated, "id": script_id, "title": s.title, "status": s.status}, ensure_ascii=False)

    elif name == "delete_script":
        script_id = int(args["script_id"])
        s = db.query(Script).filter(Script.id == script_id, Script.owner_id == owner_id).first()
        if not s:
            return json.dumps({"error": f"Không tìm thấy kịch bản ID {script_id}"})
        title = s.title
        db.delete(s)
        db.commit()
        return json.dumps({"success": True, "deleted_id": script_id, "title": title}, ensure_ascii=False)

    elif name == "list_content_history":
        limit = int(args.get("limit", 30))
        query = db.query(ContentHistory).filter(ContentHistory.owner_id == owner_id)
        if args.get("status"):
            query = query.filter(ContentHistory.status == args["status"])
        items = query.order_by(ContentHistory.created_at.desc()).limit(limit).all()
        return json.dumps([
            {
                "id": h.id, "topic": h.topic, "angle": h.angle,
                "channel": h.channel,
                "status": h.status.value if hasattr(h.status, "value") else str(h.status),
                "created_at": h.created_at.strftime("%d/%m/%Y") if h.created_at else "",
            }
            for h in items
        ], ensure_ascii=False)

    elif name == "update_content_status":
        h = db.query(ContentHistory).filter(
            ContentHistory.id == int(args["history_id"]),
            ContentHistory.owner_id == owner_id
        ).first()
        if not h:
            return json.dumps({"error": "Không tìm thấy ý tưởng"})
        h.status = args["status"]
        db.commit()
        return json.dumps({"success": True, "id": h.id, "topic": h.topic, "new_status": args["status"]}, ensure_ascii=False)

    elif name == "generate_topics":
        channel = args.get("channel", "TikTok chung")
        num_topics = int(args.get("num_topics", 3))
        extra_context = args.get("extra_context", "")
        past_topics = [r[0] for r in db.query(ContentHistory.topic).filter(ContentHistory.owner_id == owner_id).all()]
        topics = await generate_daily_topics(
            past_topics=past_topics, channel=channel,
            num_topics=num_topics, extra_context=extra_context
        )
        for t in topics:
            db.add(ContentHistory(
                topic=t.get("title", ""), angle=t.get("angle", ""),
                channel=channel, owner_id=owner_id
            ))
        db.commit()
        return json.dumps({"topics": topics, "saved_count": len(topics)}, ensure_ascii=False)

    elif name == "generate_script":
        topic = args["topic"]
        angle = args.get("angle", "")
        channel = args.get("channel", "")
        duration = int(args.get("duration_seconds", 60))
        style_notes = args.get("style_notes", "")
        script_data = await write_script(
            topic=topic, angle=angle, duration_seconds=duration,
            channel=channel, style_notes=style_notes
        )
        history = ContentHistory(topic=topic, angle=angle, channel=channel, owner_id=owner_id)
        script = Script(
            title=script_data.get("title", topic), topic=topic,
            script_data=script_data, raw_script=json.dumps(script_data, ensure_ascii=False),
            duration_seconds=duration, channel=channel,
            tags=script_data.get("hashtags", []), owner_id=owner_id,
        )
        db.add(history)
        db.add(script)
        db.commit()
        db.refresh(script)
        return json.dumps({"success": True, "saved_id": script.id, "title": script.title}, ensure_ascii=False)

    elif name == "get_project_stats":
        from sqlalchemy import func
        total_scripts = db.query(Script).filter(Script.owner_id == owner_id).count()
        by_status = dict(
            db.query(Script.status, func.count(Script.id))
            .filter(Script.owner_id == owner_id)
            .group_by(Script.status).all()
        )
        total_history = db.query(ContentHistory).filter(ContentHistory.owner_id == owner_id).count()
        channels = [r[0] for r in db.query(Script.channel).filter(Script.owner_id == owner_id).distinct().all() if r[0]]
        return json.dumps({
            "total_scripts": total_scripts,
            "by_status": by_status,
            "total_topics_in_history": total_history,
            "channels": channels,
        }, ensure_ascii=False)

    elif name == "search_web_trends":
        query = args.get("query", "")
        max_results = int(args.get("max_results", 5))
        results = await search_trending(query, max_results=max_results)
        if not results:
            return json.dumps({"message": "Không tìm thấy kết quả (Tavily key chưa cấu hình hoặc không có kết quả)", "results": []}, ensure_ascii=False)
        return json.dumps({"results": results, "count": len(results)}, ensure_ascii=False)

    elif name == "analyze_content_gaps":
        from sqlalchemy import func
        # Get all topics done
        all_topics = [r[0] for r in db.query(ContentHistory.topic).filter(ContentHistory.owner_id == owner_id).all()]
        all_titles = [r[0] for r in db.query(Script.title).filter(Script.owner_id == owner_id).all()]
        all_done = list(set(all_topics + all_titles))
        # Get RAG knowledge to understand company focus areas
        rag_ctx = _fetch_rich_rag_context(["ISO chứng nhận dịch vụ sản phẩm", "khách hàng case study", "tiêu chuẩn quy trình"], n_per_query=5)
        # Build gap analysis prompt
        done_str = "\n".join(f"- {t}" for t in all_done[:80]) if all_done else "Chưa có"
        gap_prompt = f"""Bạn là chuyên gia phân tích nội dung cho dự án video về chứng nhận ISO và quản lý chất lượng doanh nghiệp.

{rag_ctx}

Danh sách chủ đề/kịch bản đã làm:
{done_str}

Hãy phân tích và trả về JSON với cấu trúc:
{{
  "covered_topics": ["chủ đề đã làm tốt 1", "..."],
  "gap_categories": [
    {{"category": "Tên lĩnh vực còn thiếu", "why_important": "Tại sao quan trọng", "suggested_topics": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"]}},
  ],
  "priority_recommendation": "Lĩnh vực nên ưu tiên làm ngay nhất và lý do"
}}

Chỉ trả về JSON, không có text khác."""
        from services.gemini_service import generate_text as gen_text
        raw = await gen_text(gap_prompt, temperature=0.7)
        raw = raw.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        try:
            return raw  # already JSON
        except Exception:
            return json.dumps({"analysis": raw}, ensure_ascii=False)

    elif name == "create_content_calendar":
        days = max(1, min(int(args.get("days", 7)), 30))
        vpd = max(1, min(int(args.get("videos_per_day", 1)), 3))
        channel = args.get("channel", "TikTok chung")
        theme = args.get("theme", "")
        past_topics = [r[0] for r in db.query(ContentHistory.topic).filter(ContentHistory.owner_id == owner_id).all()]
        calendar = []
        saved = 0
        from datetime import datetime, timedelta
        today = datetime.now()
        for day_offset in range(days):
            date_label = (today + timedelta(days=day_offset)).strftime("%d/%m/%Y")
            extra = f"Ngày {date_label}. {f'Chủ đề xuyên suốt: {theme}. ' if theme else ''}Đây là ngày {day_offset+1}/{days} trong kế hoạch."
            topics = await generate_daily_topics(
                past_topics=past_topics, channel=channel,
                num_topics=vpd, extra_context=extra
            )
            for t in topics:
                past_topics.append(t.get("title", ""))
                db.add(ContentHistory(
                    topic=t.get("title", ""), angle=t.get("angle", ""),
                    channel=channel, owner_id=owner_id
                ))
                saved += 1
            calendar.append({"date": date_label, "topics": topics})
        db.commit()
        return json.dumps({"calendar": calendar, "total_saved": saved, "days": days}, ensure_ascii=False)

    elif name == "rewrite_script":
        script_id = int(args["script_id"])
        new_style = args["new_style"]
        extra_notes = args.get("extra_notes", "")
        s = db.query(Script).filter(Script.id == script_id, Script.owner_id == owner_id).first()
        if not s:
            return json.dumps({"error": f"Không tìm thấy kịch bản ID {script_id}"})
        original = s.raw_script or json.dumps(s.script_data or {}, ensure_ascii=False)
        rag_ctx = _fetch_rich_rag_context([s.title, "dịch vụ ISO chứng nhận doanh nghiệp"], n_per_query=5)
        rewrite_prompt = f"""Bạn là chuyên gia viết kịch bản TikTok.

{rag_ctx}

⚠️ QUY TẮc: Chỉ sử dụng thông tin thực tế từ thư viện kiến thức bên trên. KHÔNG bịa ra sự kiện, số liệu, tên khách hàng. KHÔNG nhắc tên công ty sản xuất.

Kịch bản gốc:
{original[:3000]}

Yêu cầu: Viết lại kịch bản trên theo phong cách **{new_style}**.
{f'Ghi chú thêm: {extra_notes}' if extra_notes else ''}

Giữ nguyên chủ đề và thông điệp chính, nhưng thay đổi hoàn toàn cách diễn đạt, cấu trúc phân đoạn, lời thuyết minh.

Trả về JSON theo định dạng kịch bản video AI chuẩn:
{{
  "title": "Tiêu đề mới",
  "total_duration": {s.duration_seconds or 60},
  "style": "{new_style}",
  "hook": "Câu mở đầu gây sốc/tò mò",
  "segments": [
    {{
      "segment_number": 1,
      "duration": 10,
      "voiceover": "...",
      "on_screen_text": "...",
      "visual_prompt": "...",
      "transition": "..."
    }}
  ],
  "background_music": "...",
  "hashtags": [...],
  "ai_tools": "..."
}}
Chỉ trả về JSON."""
        from services.gemini_service import generate_text as gen_text
        raw = await gen_text(rewrite_prompt, temperature=0.85)
        raw = raw.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        try:
            new_data = json.loads(raw)
        except Exception:
            new_data = {"title": s.title, "style": new_style, "raw": raw}
        # Save as new script
        new_script = Script(
            title=new_data.get("title", f"{s.title} [{new_style}]"),
            topic=s.topic,
            script_data=new_data,
            raw_script=json.dumps(new_data, ensure_ascii=False),
            duration_seconds=s.duration_seconds,
            channel=s.channel,
            tags=new_data.get("hashtags", s.tags or []),
            owner_id=owner_id,
        )
        db.add(new_script)
        db.commit()
        db.refresh(new_script)
        return json.dumps({
            "success": True,
            "new_script_id": new_script.id,
            "new_title": new_script.title,
            "style": new_style,
            "original_id": script_id,
        }, ensure_ascii=False)

    return json.dumps({"error": f"Unknown tool: {name}"})


async def generate_daily_topics(
    past_topics: list[str],
    channel: str,
    num_topics: int = 3,
    extra_context: str = "",
) -> list[dict]:
    """
    Generate N new, non-duplicate topic ideas for today.
    Returns a list of {title, angle, hook, estimated_duration}.
    """
    # Step 1: Web search for trends
    from datetime import datetime as _dt
    current_year = _dt.now().year
    search_query = f"TikTok trending AI video {channel} {extra_context} {current_year}"
    search_results = await search_trending(search_query, max_results=5)
    search_ctx = format_search_results(search_results)

    # Step 2: RAG — multi-query for richer company knowledge
    rag_queries = [
        "dịch vụ ISO chứng nhận tiêu chuẩn sản phẩm",
        f"nội dung video {channel} {extra_context}".strip(),
        "khách hàng case study doanh nghiệp đạt chứng nhận",
        "lợi ích ISO quy trình cải tiến doanh nghiệp",
    ]
    rag_ctx = _fetch_rich_rag_context(rag_queries, n_per_query=5)
    has_knowledge = bool(rag_ctx)

    # Step 3: Build anti-duplication prompt
    history_str = "\n".join(f"- {t}" for t in past_topics[:60]) if past_topics else "Chưa có"

    knowledge_instruction = (
        "QUY TAC BAT BUOC VE DO CHINH XAC:\n"
        "- Moi y tuong PHAI duoc lay truc tiep tu thong tin trong phan 'THU VIEN KIEN THUC DU AN' ben tren.\n"
        "- KHONG duoc tu che ra ten khach hang, so lieu, chung nhan cu the, hoac case study neu khong co trong thu vien.\n"
        "- Neu muon de cap den khach hang/case study -> chi dung thong tin da co trong thu vien kien thuc.\n"
        "- TUYET DOI khong dua ten cong ty san xuat noi dung vao trong y tuong video.\n"
        "- Neu thu vien it du lieu -> tao y tuong giao duc ISO chung (educational content), KHONG bia thong tin cong ty."
        if has_knowledge else
        "Thu vien kien thuc hien chua co du lieu. "
        "Chi tao y tuong giao duc ISO/chung nhan chung (educational content) dua tren kien thuc ISO tieu chuan. "
        "KHONG bia ra thong tin cu the ve bat ky cong ty nao khi chua co trong thu vien."
    )

    prompt = f"""{SYSTEM_PROMPT}

{rag_ctx}

{search_ctx}

{knowledge_instruction}

=== LỊCH SỬ CHỦ ĐỀ ĐÃ LÀM (KHÔNG được trùng lặp) ===
{history_str}
=====================================================

Yêu cầu: Tạo **{num_topics} chủ đề video TikTok mới** cho kênh "{channel}".
- Tỷ lệ trùng lặp ý tưởng tối đa {int(settings.MAX_DUPLICATION_RATE * 100)}%.
- Mỗi chủ đề phải có góc tiếp cận (angle) khác biệt.
- Ưu tiên khai thác thông tin từ thư viện kiến thức dự án.
{f'- Yêu cầu bổ sung: {extra_context}' if extra_context else ''}

Trả về **JSON array** (chỉ JSON, không có text nào khác) theo định dạng:
[
  {{
    "title": "Tiêu đề hấp dẫn của video",
    "angle": "Góc tiếp cận độc đáo (ví dụ: POV, storytelling, tutorial...)",
    "hook": "Câu mở đầu 3 giây đầu video để giữ người xem",
    "estimated_duration": 60,
    "tags": ["tag1", "tag2"],
    "knowledge_source": "Tóm tắt ngắn thông tin từ thư viện kiến thức đã dùng (hoặc 'Giáo dục ISO chung' nếu không có)"
  }}
]"""

    raw = await generate_text(prompt, temperature=0.9)

    # Extract JSON from response
    raw = raw.strip()
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        topics = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped
        topics = [{"title": raw, "angle": "", "hook": "", "estimated_duration": 60, "tags": []}]

    return topics


async def write_script(
    topic: str,
    angle: str,
    duration_seconds: int = 60,
    channel: str = "",
    style_notes: str = "",
) -> dict:
    """
    Generate a full, detailed shooting script for a given topic.
    Returns {title, scenes: [{scene_number, shot_type, audio, dialogue, action, duration}], notes}
    """
    rag_queries = [
        topic,
        "dịch vụ ISO chứng nhận tiêu chuẩn sản phẩm",
        "khách hàng case study doanh nghiệp đạt chứng nhận",
    ]
    rag_ctx = _fetch_rich_rag_context(rag_queries, n_per_query=6)
    has_knowledge = bool(rag_ctx)

    search_results = await search_trending(f"{topic} TikTok viral script", max_results=3)
    search_ctx = format_search_results(search_results)

    knowledge_instruction = (
        "QUY TAC BAT BUOC - DO TRUNG THUC KIEN THUC:\n"
        "- Moi su kien, so lieu, ten san pham, ten khach hang, thanh tich PHAI lay tu 'THU VIEN KIEN THUC DU AN' ben tren.\n"
        "- KHONG duoc bia ra case study, khach hang khong co trong thu vien.\n"
        "- Neu can so lieu cu the ma thu vien khong co -> dung con so chung chung ('nhieu doanh nghiep', 'cac don vi...') thay vi bia.\n"
        "- Tich hop toi thieu 2 thong tin cu the tu thu vien kien thuc vao noi dung kich ban.\n"
        "- TUYET DOI khong dua ten cong ty san xuat noi dung vao loi thoai, caption, hay hashtag."
        if has_knowledge else
        "Thu vien kien thuc chua co du lieu cu the. "
        "Viet kich ban giao duc ISO chung, KHONG bia thong tin cong ty, khach hang, hoac so lieu."
    )

    prompt = f"""{SYSTEM_PROMPT}

{rag_ctx}

{search_ctx}

{knowledge_instruction}

Viết kịch bản video AI (dùng AI tạo) cho nội dung sau:
- **Chủ đề:** {topic}
- **Góc tiếp cận:** {angle}
- **Thời lượng mục tiêu:** {duration_seconds} giây
- **Kênh:** {channel}
{f'- **Ghi chú phong cách:** {style_notes}' if style_notes else ''}

Video này sử dụng công cụ AI (AI voice, AI image/video gen, text overlay) — KHÔNG phải quay thực tế.

Trả về **JSON** (chỉ JSON, không có text nào khác) theo định dạng:
{{
  "title": "Tiêu đề video",
  "total_duration": {duration_seconds},
  "hook": "Câu mở đầu 3 giây đầu — gây sốc, tò mò hoặc đánh vào pain point",
  "segments": [
    {{
      "segment_number": 1,
      "duration": 10,
      "voiceover": "Nội dung lời kể / thuyết minh do AI voice đọc",
      "on_screen_text": "Text ngắn hiển thị lên màn hình (caption / headline)",
      "visual_prompt": "Mô tả hình ảnh/video AI cần tạo ra (ví dụ: 'Professional Vietnamese businessman reviewing documents in modern office, photorealistic')",
      "transition": "fade / cut / zoom in"
    }}
  ],
  "background_music": "Loại nhạc nền phù hợp (VD: Corporate upbeat, Cinematic, Lo-fi chill)",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "ai_tools": "Gợi ý công cụ AI phù hợp (VD: HeyGen avatar, ElevenLabs voice, Runway video, Canva AI)"
}}"""

    raw = await generate_text(prompt, temperature=0.75)
    raw = raw.strip()
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        script_data = json.loads(raw)
    except json.JSONDecodeError:
        script_data = {"title": topic, "total_duration": duration_seconds, "segments": [], "raw": raw}

    return script_data


async def chat_with_agent(
    user_message: str,
    history: list[dict],
    script_context: str = "",
    db_context: str = "",
    db=None,
    owner_id: int = 0,
) -> AsyncGenerator[str, None]:
    """
    Streaming chat with full project management via Gemini function calling.
    history format: [{"role": "user"|"assistant", "content": "..."}]
    """
    rag_ctx = build_rag_context(user_message)

    # Web search if relevant
    search_ctx = ""
    trend_keywords = ["viral", "trending", "xu hướng", "tiktok", "tìm", "search", "hot", "ai tool", "ai video", "heygen", "elevenlabs", "runway", "pika"]
    if any(kw in user_message.lower() for kw in trend_keywords):
        results = await search_trending(user_message, max_results=4)
        search_ctx = format_search_results(results)

    # Build system instruction with live context
    system_parts = [SYSTEM_PROMPT]
    if rag_ctx:
        system_parts.append(rag_ctx)
    if search_ctx:
        system_parts.append(search_ctx)
    if db_context:
        system_parts.append(
            f"=== NGỮ CẢNH DỰ ÁN HIỆN TẠI (snapshot) ===\n{db_context}\n=============================================\n"
            "(Snapshot này có thể cũ — hãy gọi tool để lấy dữ liệu mới nhất khi cần.)"
        )
    if script_context:
        system_parts.append(f"=== KỊCH BẢN ĐANG MỞ ===\n{script_context}\n========================")
    full_system = "\n\n".join(system_parts)

    # Build contents from conversation history
    contents = []
    for msg in history[-10:]:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(gtypes.Content(role=role, parts=[gtypes.Part(text=msg["content"])]))
    contents.append(gtypes.Content(role="user", parts=[gtypes.Part(text=user_message)]))

    client = _get_client()
    model = _get_effective_model()

    config_with_tools = gtypes.GenerateContentConfig(
        temperature=0.8,
        system_instruction=full_system,
        tools=[_AGENT_TOOLS],
        tool_config=gtypes.ToolConfig(
            function_calling_config=gtypes.FunctionCallingConfig(mode="AUTO")
        ),
    )
    config_final = gtypes.GenerateContentConfig(
        temperature=0.8,
        system_instruction=full_system,
    )

    # Agentic loop — up to 5 rounds of tool use
    tool_summaries = []
    for _round in range(5):
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config_with_tools,
        )

        model_parts = response.candidates[0].content.parts
        has_fn_call = any(getattr(p, "function_call", None) for p in model_parts)

        if not has_fn_call:
            break  # No more tool calls — proceed to stream final answer

        # Append model turn with function calls
        contents.append(gtypes.Content(role="model", parts=model_parts))

        # Execute every function call in this turn
        fn_response_parts = []
        for part in model_parts:
            fc = getattr(part, "function_call", None)
            if not fc:
                continue
            try:
                result = await _execute_tool(fc.name, dict(fc.args), db, owner_id)
            except Exception as exc:
                result = json.dumps({"error": str(exc)})
            tool_summaries.append(f"[{fc.name}] → {result[:120]}…")
            fn_response_parts.append(gtypes.Part(
                function_response=gtypes.FunctionResponse(name=fc.name, response={"result": result})
            ))

        contents.append(gtypes.Content(role="user", parts=fn_response_parts))

    # Stream the final text answer
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config_final,
    ):
        if chunk.text:
            yield chunk.text
