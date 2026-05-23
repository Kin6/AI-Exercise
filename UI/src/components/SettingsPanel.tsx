import React, { useState } from "react";
import { User, Bell, Shield, Bluetooth, HelpCircle, CreditCard, ChevronRight, VolumeX, Volume2 } from "lucide-react";
import { motion } from "motion/react";

export const SettingsPanel: React.FC = () => {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState("20:30");
  const [cameraGranted, setCameraGranted] = useState(true);

  const menuGroups = [
    {
      title: "基础服务 Options",
      items: [
        { label: "会员与订阅", icon: <CreditCard className="w-4 h-4 text-indigo-400" />, badge: "免费体验中" },
        { label: "训练提醒时间", icon: <Bell className="w-4 h-4 text-amber-400" />, extra: notificationTime },
      ]
    },
    {
      title: "隐私权限及连接 Checkpoint",
      items: [
        { label: "摄像头权限状态", icon: <Shield className="w-4 h-4 text-emerald-400" />, action: cameraGranted ? "已授权" : "未授权", border: true },
        { label: "关联智能手表/心率带", icon: <Bluetooth className="w-4 h-4 text-cyan-400" />, action: "已连接 (Apple Watch)" },
      ]
    },
    {
      title: "技术与支持 Support",
      items: [
        { label: "智能纠正实时语音支持", icon: voiceEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4 text-slate-500" /> },
        { label: "使用指南与客服反馈", icon: <HelpCircle className="w-4 h-4 text-slate-400" /> },
      ]
    }
  ];

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-4 scrollbar-none" id="settings_panel">
      {/* Profile Header Block */}
      <div className="bg-slate-850 border border-slate-800 rounded-3xl p-5 flex items-center gap-4 mb-6 shadow-md">
        <div className="w-14 h-14 rounded-full bg-indigo-950 border-2 border-indigo-500/30 flex items-center justify-center font-black text-indigo-300 text-lg shadow-inner">
          思琪
        </div>
        <div>
          <h3 className="text-base font-black text-slate-100 flex items-center gap-1.5">
            刘思琪
          </h3>
          <span className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-950/60 border border-indigo-500/10 px-2 py-0.5 rounded-full mt-1.5 inline-block">
            🏆 小摩超级觉察官
          </span>
        </div>
      </div>

      {/* Menu Settings lines list */}
      <div className="space-y-5">
        {menuGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-2">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1.5">
              {group.title}
            </h4>

            <div className="bg-slate-850/90 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/50">
              {group.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-800/30 cursor-pointer transition text-xs relative"
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span className="text-slate-200 font-medium">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="bg-indigo-950 border border-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}

                    {item.extra && (
                      <input
                        type="time"
                        value={item.extra}
                        onChange={(e) => setNotificationTime(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-[11px] text-indigo-300 font-mono py-0.5 px-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
                      />
                    )}

                    {item.action && (
                      <span className="text-[10px] text-slate-400 font-mono font-semibold">
                        {item.action}
                      </span>
                    )}

                    {item.label === "智能纠正实时语音支持" && (
                      <button
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className={`w-10 h-5.5 rounded-full p-0.5 transition-all outline-none ${
                          voiceEnabled ? "bg-purple-600 flex justify-end" : "bg-slate-800 flex justify-start"
                        }`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-md block" />
                      </button>
                    )}

                    {item.label !== "智能纠正实时语音支持" && !item.extra && (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* App details watermark */}
      <div className="text-center mt-12 mb-12 space-y-1">
        <p className="text-[10px] text-slate-600 font-mono">小摩放松 iOS Ver 3.10.4</p>
        <p className="text-[10px] text-slate-700 font-mono">Build with Gemini Kinesiology algorithms</p>
      </div>
    </div>
  );
};
