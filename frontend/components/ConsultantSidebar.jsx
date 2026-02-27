// components/consultant-sidebar.jsx
import React from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

export function ConsultantSidebar({
  chats = [],
  activeChat,
  onSelectChat = () => {},
  onNewChat = () => {},
  onDeleteChat = () => {},
  className = "",
}) {
  return (
    <div className={`flex flex-col h-full border-r bg-white ${className}`}>
      {/* Brand/Header */}
      <div className="p-4 text-xl font-bold text-black border-b">
        VariantWise AI
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        <div className="text-sm font-semibold text-gray-500 mb-1">Chat Sessions</div>
        {chats.length > 0 ? (
          chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition ${
                activeChat === chat.id ? "bg-gray-200 font-semibold" : ""
              }`}
            >
              {chat.title}
            </button>
          ))
        ) : (
          <div className="text-xs text-gray-400">No chats yet</div>
        )}
      </div>

      {/* New Chat */}
      <div className="p-4 border-t">
        <Button
          onClick={onNewChat}
          className="w-full bg-primary-600 text-white hover:bg-primary-700"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>
    </div>
  )
}

export default ConsultantSidebar
