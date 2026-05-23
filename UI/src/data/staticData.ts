import { DiscomfortFeel, DiscomfortArea, DiagnosisData } from "../types";

export const DISCOMFORT_FEELS: DiscomfortFeel[] = [
  { id: "suan", label: "酸胀", icon: "😮‍💨" },
  { id: "jin", label: "发紧", icon: "⚡" },
  { id: "pibei", label: "疲惫", icon: "💤" },
  { id: "chenzhong", label: "沉重", icon: "🪨" },
  { id: "wuli", label: "无力", icon: "🩹" },
  { id: "jiangying", label: "僵硬", icon: "🪵" },
];

export const DISCOMFORT_AREAS: DiscomfortArea[] = [
  { id: "neck", label: "颈肩", x: 50, y: 35 },
  { id: "back", label: "腰背", x: 50, y: 55 },
  { id: "legs", label: "腿部", x: 50, y: 78 },
  { id: "全身", label: "全身", x: 50, y: 20 },
];

export const SCENARIOS = [
  "久坐后 / 长期对电脑",
  "准备上床睡前",
  "长时间低头看手机",
  "高强度运动健身后",
];

export const MASCOT_LEVELS = [
  { lvl: 0, title: "疲惫阶段", text: "身体沉重，需要休息与温柔照顾", color: "from-purple-300 to-indigo-400" },
  { lvl: 1, title: "觉察阶段", text: "开始关注自己，倾听身体微妙信号", color: "from-purple-400 to-indigo-500" },
  { lvl: 2, title: "启动阶段", text: "迈出微拉伸第一步，血液开始苏醒", color: "from-indigo-400 to-purple-500" },
  { lvl: 3, title: "坚持阶段", text: "逐渐合拍，能感受到骨盆和脊柱舒展", color: "from-purple-500 to-violet-500" },
  { lvl: 4, title: "成长阶段", text: "深层稳定肌被唤醒，姿态更轻盈", color: "from-violet-500 to-fuchsia-500" },
  { lvl: 5, title: "轻盈阶段", text: "呼吸悠长，能量在四肢间顺畅流动", color: "from-fuchsia-500 to-cyan-500" },
  { lvl: 6, title: "通透阶段", text: "身体通透自在，与重力达成温柔和解", color: "from-cyan-400 to-emerald-400" },
];

export const PRESET_DIAGNOSES: Record<string, DiagnosisData> = {
  neck: {
    diagnosis: "肩颈过度负荷：斜方肌上束代偿 + 表层肌肉高张力",
    mechanisms: [
      "1. 长时间含胸低头看屏，头部重心每前倾1厘米，颈椎负重增加2公斤",
      "2. 深层颈屈肌（头前直肌等）缺乏支撑，开启离线睡眠模式",
      "3. 浅层斜方肌上束、肩胛提肌强行缩短吊住头部，导致无菌性筋膜炎",
      "4. 肩膀及后脑底部酸沉僵硬，血液微循环受阻"
    ],
    muscles: [
      {
        name: "斜方肌上束 (Upper Trapezius)",
        position: "颈脊两侧延伸到双肩外缘",
        issue: "持续拉扯处于离心收缩状态，出现扳机点（Trigger Points）",
        feeling: "沉重如负巨石，习惯性耸肩"
      },
      {
        name: "肩胛提肌 (Levator Scapulae)",
        position: "上椎骨到肩胛骨内上角",
        issue: "长期低头使得纤维僵硬变短",
        feeling: "转头、仰头时后脑勺到脖根产生牵扯拉紧感"
      }
    ],
    routine: [
      {
        step: 1,
        type: "relax",
        name: "颈侧放松轻拉伸",
        duration: "30秒 × 2侧",
        focus: "拉伸肩胛提肌，温柔倾倒头部，另一侧手下沉压实椅面，禁止猛烈拉拽",
        svgIcon: "stretch"
      },
      {
        step: 2,
        type: "activate",
        name: "深层下巴内收 (Chin Tuck)",
        duration: "10次 × 2组",
        focus: "手指轻触下巴水平后推，眼睛看前方，感觉后颈椎顶端被拉直拉长",
        svgIcon: "tuck"
      },
      {
        step: 3,
        type: "check",
        name: "过头手臂垂直伸展",
        duration: "10秒 AI 观察",
        focus: "双臂自然高举，AI多点评估双侧锁骨是否对称，是否代偿性耸肩",
        svgIcon: "camera"
      }
    ]
  },
  back: {
    diagnosis: "下背部负荷紊乱：腹横肌力流失 + 竖脊肌代偿挤压",
    mechanisms: [
      "1. 办公久坐弓背塌腰，腹部原装核心支撑力『关机』",
      "2. 骨盆倾斜，腰椎生理曲度变直或过度前突",
      "3. 竖脊肌背侧段和腰方肌被迫过度用力保持身体平衡",
      "4. 局部乳酸大量堆积，伴随起床或久坐起立时的刺痛与僵直"
    ],
    muscles: [
      {
        name: "腰椎竖脊肌 (Erector Spinae)",
        position: "脊柱正中后侧两侧肌肉沟",
        issue: "处于一整天高张力痉挛下，失去正常肌肉弹性",
        feeling: "久坐站起的一瞬间，后腰犹如木板断裂般酸木"
      },
      {
        name: "腹横肌与多裂肌 (Deep Core)",
        position: "腹腔最深层腰带区",
        issue: "长期不被征用而退化无力，骨盆前倾漏气",
        feeling: "肚皮松弛，日常稍微站一会就会觉得后腰腰肌先累"
      }
    ],
    routine: [
      {
        step: 1,
        type: "relax",
        name: "仰卧猫抱膝翻滚",
        duration: "45秒 揉按",
        focus: "双手抱膝让大腿贴近胸口，前后左右微滚，舒展释放腰椎段关节间压力",
        svgIcon: "stretch"
      },
      {
        step: 2,
        type: "activate",
        name: "鸟狗对角支撑 (Bird Dog)",
        duration: "8次/对侧 × 2组",
        focus: "四足跪姿，对侧手脚水平慢伸。收腹不塌腰，重塑前后斜动力链",
        svgIcon: "tuck"
      },
      {
        step: 3,
        type: "check",
        name: "单腿骨盆平衡抗阻",
        duration: "15秒 AI 观察",
        focus: "AI观察重心足在单脚离地时是否骨盆严重侧斜，评估核心侧向稳定",
        svgIcon: "camera"
      }
    ]
  },
  legs: {
    diagnosis: "下肢生物力学偏移：髌骨轨迹不均 + 臀中肌稳定欠缺",
    mechanisms: [
      "1. 骨盆侧倾或走路重心倾斜导致双侧大腿内旋力增大",
      "2. 臀中肌和臀小肌失活，无法拉住大腿骨在大腿中轴线上",
      "3. 大腿外侧阔筋膜张肌（TFL）与髂胫束被拉近锁死代偿",
      "4. 下蹲、跑跳、上下楼梯时外侧受到应力拉扯，引发膝痛"
    ],
    muscles: [
      {
        name: "阔筋膜张肌 (TFL / 髂胫束)",
        position: "大腿髋骨外侧连到膝关节外侧",
        issue: "因臀中肌无力，被迫承担过度的侧向抗晃抗扭重任",
        feeling: "膝关节外表按压有痛点，弯曲时刺摩擦般痛"
      },
      {
        name: "臀中肌 (Gluteus Medius)",
        position: "骨盆外上侧臀窝处",
        issue: "平时久坐屁股变平，侧倒及支撑阶段完全不吃力",
        feeling: "单脚站立身体不由自主往另一侧歪斜，走路拖拉"
      }
    ],
    routine: [
      {
        step: 1,
        type: "relax",
        name: "大腿外侧泡沫自摩/拉伸",
        duration: "40秒 × 2侧",
        focus: "对侧支撑脚踩在身体外侧，被拉伸侧大腿缓缓向对侧偏移，消除外侧韧带高压",
        svgIcon: "stretch"
      },
      {
        step: 2,
        type: "activate",
        name: "侧卧蚌式抗代偿 (Clamshell)",
        duration: "10次 × 2侧",
        focus: "侧卧屈膝，骨盆绝对垂直于地面。脚跟并拢，利用小臂撑地，缓慢打开上侧膝大腿",
        svgIcon: "tuck"
      },
      {
        step: 3,
        type: "check",
        name: "自重向后蹲位观察",
        duration: "5次动作",
        focus: "AI检测深蹲离心阶段膝盖中线是否与第二脚趾尖重叠，防止髌骨撞击",
        svgIcon: "camera"
      }
    ]
  }
};
