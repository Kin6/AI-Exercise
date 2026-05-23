import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

  const teachingVideoDir = [
    path.resolve(process.cwd(), "assets", "videoTeaching"),
    path.resolve(process.cwd(), "..", "assets", "videoTeaching"),
    path.resolve(process.cwd(), "..", "ai-fitness-coach", "assets", "videoTeaching"),
  ].find((candidate) => fs.existsSync(candidate));

  if (teachingVideoDir) {
    app.use("/videoTeaching", express.static(teachingVideoDir));
  } else {
    console.warn("WARNING: videoTeaching assets folder was not found.");
  }

  // Initialize Gemini API client with required User-Agent
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    console.warn("WARNING: GEMINI_API_KEY is not defined. Using smart kinesiology response logic fallback.");
  }

  // Posture diagnostics & dynamic rehabilitation routing engine
  app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!ai) {
      return res.json(getFallbackDiagnosis(message));
    }

    try {
      const systemPrompt = `You are "小摩" (Xiaomo), an elite compassionate sports rehabilitation therapist and physical therapy companion mascot.
Your job is to analyze the user's physical symptom or fatigue described in Chinese (e.g. "今天做了一天PPT，肩膀特别沉……" or "深蹲的时候腰有些紧"), explain why this happens using kinetic chain compensation (表层肌肉代偿 / 关节力线紊乱), list the specific involved muscles with their position and symptoms, and generate a personalized 3-step physical relief routine.

Your response must be STRICTLY structured as a valid JSON object matching the schema below. Do not wrap in backticks or markdown, output ONLY raw JSON.

JSON Schema:
{
  "diagnosis": "Warm, sympathetic, professional therapeutic overview in Chinese analyzing why the pain happens under their scenario (e.g. '肩颈疲惫 + 斜方肌代偿引起的无菌性张力增高')",
  "mechanisms": [
    "Step-by-step kinetic flowchart lines in Chinese (e.g., '1. 骨盆前倾或久坐不动', '2. 腹横肌/臀肌失活', '3. 竖脊肌强制代偿收缩', '4. 腰部神经受压酸痛')"
  ],
  "muscles": [
    {
      "name": "Trapezius (斜方肌上束)",
      "position": "后颈侧到肩膀顶端",
      "issue": "低头缩肩时首当其冲，长期高负荷离心收缩导致劳损",
      "feeling": "肩膀极度沉重、像压了块石头、按压有明显酸胀点"
    },
    {
      "name": "Levator Scapulae (肩胛提肌)",
      "position": "颈椎横突至肩胛骨内上角",
      "issue": "过度前伸颈部时被动扯拉，僵持不下",
      "feeling": "转头时有一根筋扯着疼、僵硬发木"
    }
  ],
  "routine": [
    {
      "step": 1,
      "type": "relax",
      "name": "颈侧轻拉伸",
      "duration": "30秒 × 2侧",
      "focus": "放松斜方肌上束和肩胛提肌，切忌暴力拉扯，轻柔获得牵拉感即可",
      "svgIcon": "stretch"
    },
    {
      "step": 2,
      "type": "activate",
      "name": "下巴内收 (Chin Tuck)",
      "duration": "10次 × 2组",
      "focus": "重新激活枕骨下深层屈肌，改善头前伸，把头收回中立位",
      "svgIcon": "tuck"
    },
    {
      "step": 3,
      "type": "check",
      "name": "过头手臂伸展 (AI动作观察)",
      "duration": "10秒检测",
      "focus": "双臂高抬，由AI多骨架检测肩膀是否不对称耸起或外展代偿",
      "svgIcon": "camera"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analyze following symptom and generate the correct JSON format requested in system prompt: "${message}"`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.15,
          responseMimeType: "application/json"
        }
      });

      const text = response.text?.trim() || "{}";
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err) {
      console.error("Gemini API call fell back:", err);
      res.json(getFallbackDiagnosis(message));
    }
  });

  // Serve static assets in production, use Vite's HMR server in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[小摩放松] Full-stack Server live on http://0.0.0.0:${PORT}`);
  });
}

function getFallbackDiagnosis(message: string) {
  const norm = message.toLowerCase();
  
  if (norm.includes("腰") || norm.includes("胯") || norm.includes("臀") || norm.includes("坐")) {
    return {
      diagnosis: "久坐下腰代偿状态：竖脊肌超载 + 腹深层核心松弛",
      mechanisms: [
        "1. 长时间含胸弓背久坐，骨盆后倾或前倾紊乱",
        "2. 核心腹横肌失去主动控制，无法维持腹腔内压",
        "3. 竖脊肌与后腰方肌强行参与脊柱直立支撑，离心代偿",
        "4. 下腰深层筋膜产生无菌性炎症，酸胀发僵"
      ],
      muscles: [
        {
          name: "竖脊肌 (Erector Spinae)",
          position: "脊柱两侧的长条肌群",
          issue: "核心懒惰时，腰椎竖脊肌承担两倍体重，酸胀过度",
          feeling: "弓腰后仰时，下腰部有折断似的酸软疼"
        },
        {
          name: "臀大肌与腹横肌 (Stabilizers)",
          position: "臀下方及腹部最深层",
          issue: "受压制而处于冬眠状态，神经调控退化",
          feeling: "无法靠腹肌收腹，站累时习惯顶小腹"
        }
      ],
      routine: [
        {
          step: 1,
          type: "relax",
          name: "仰卧脊柱扭转",
          duration: "40秒 × 2侧",
          focus: "拉伸并放松紧绷的胸腰筋膜，增加胸椎段自转活动度",
          svgIcon: "stretch"
        },
        {
          step: 2,
          type: "activate",
          name: "鸟狗平衡激活 (Bird Dog)",
          duration: "8次 × 2组",
          focus: "激活对角侧核心和臀肌，重新学会对角轴线的力传导",
          svgIcon: "tuck"
        },
        {
          step: 3,
          type: "check",
          name: "单腿站立平衡 (AI动作观察)",
          duration: "15秒检测",
          focus: "AI观察左右骨盆侧倾角，纠正重心跑偏与摇晃代偿",
          svgIcon: "camera"
        }
      ]
    };
  }

  if (norm.includes("腿") || norm.includes("膝") || norm.includes("蹲") || norm.includes("跑")) {
    return {
      diagnosis: "大腿与膝肘受力紊乱：股四头肌紧绷 + 臀中肌稳定不足",
      mechanisms: [
        "1. 走路或深蹲时骨盆控制力差，大腿骨内旋",
        "2. 臀中肌/臀小肌失活，无法约束股骨姿态",
        "3. 髌关节骨力线向外偏移，大腿前侧（阔筋膜张肌）过载征调",
        "4. 膝盖骨周及大腿外侧韧带酸痛"
      ],
      muscles: [
        {
          name: "阔筋膜张肌 (TFL / 髂胫束)",
          position: "大腿外侧顶端至膝盖外侧",
          issue: "稳定骨盆副手喧宾夺主，拉力带一样勒死股骨外侧",
          feeling: "下蹲、跑步时膝关节外侧突起骨头按压有明显尖灼感"
        },
        {
          name: "臀中肌 (Gluteus Medius)",
          position: "臀部外侧侧上方",
          issue: "长时间坐立骨盆歪斜，肌肉力学退色，无力支撑侧向力道",
          feeling: "走路或单腿站立时下屁股松松垮垮晃动"
        }
      ],
      routine: [
        {
          step: 1,
          type: "relax",
          name: "大腿外侧轻柔伸拉",
          duration: "30秒 × 2侧",
          focus: "释放髂胫束高张力状态，舒缓膝盖上牵拉骨压",
          svgIcon: "stretch"
        },
        {
          step: 2,
          type: "activate",
          name: "侧卧蚌式开合 (Clamps)",
          duration: "10次 × 2侧",
          focus: "高靶向激活萎缩的臀中肌，让骨盆重新获得侧向稳轴",
          svgIcon: "tuck"
        },
        {
          step: 3,
          type: "check",
          name: "自重深蹲膝角 (AI动作观察)",
          duration: "5次动作",
          focus: "AI观察膝端连线与脚尖是否始终在一条垂直切面上，防内扣",
          svgIcon: "camera"
        }
      ]
    };
  }

  // Heavy shoulder ppt work default
  return {
    diagnosis: "肩颈过度代偿状态：斜方肌高负荷 + 深层颈屈足代偿",
    mechanisms: [
      "1. 盯着PPT或电脑时习惯性脖子前伸",
      "2. 颈椎深层肌抗重力力偶失效",
      "3. 浅层斜方肌上束、肩胛提肌强直性拉伸头部",
      "4. 肩胛骨回缩受限，产生局灶性肌肉痉挛、僵硬酸麻"
    ],
    muscles: [
      {
        name: "斜方肌上束 (Trapezius)",
        position: "后颈发际线至肩膀顶角",
        issue: "被迫顶班，肌肉里的毛细血管受压而导致乳酸无法代谢",
        feeling: "沉重酸板、手捏上去跟砖头一样硬、耸肩时极其累"
      },
      {
        name: "深层颈屈肌群 (Deep Neck Flexors)",
        position: "咽颈部贴椎骨前侧",
        issue: "被抑制进入关机状态，肌肉无力萎缩，无法完成收下巴动作",
        feeling: "深按脖子前方没有支撑力、下巴不自觉抬高手伸"
      }
    ],
    routine: [
      {
        step: 1,
        type: "relax",
        name: "颈侧轻拉伸",
        duration: "30秒 × 2侧",
        focus: "拉伸肩胛提肌与斜方肌上束，降低耸肩紧张",
        svgIcon: "stretch"
      },
      {
        step: 2,
        type: "activate",
        name: "下巴内收 (Chin Tuck)",
        duration: "10次 × 2组",
        focus: "激活稳定抗代偿，让深层屈肌把脖子拉回中央",
        svgIcon: "tuck"
      },
      {
        step: 3,
        type: "check",
        name: "过头手臂伸展 (AI动作观察)",
        duration: "10秒检测",
        focus: "高抬手臂姿势下，AI检测肩膀异常高度、是否耸搭",
        svgIcon: "camera"
      }
    ]
  };
}

startServer();
