import { matchFaq, hasSiteAnchor, selectContextSnippets } from "./matchQuestion";
import { buildSystemPrompt, getOffTopicReply } from "./systemPrompt";
import { callOpenAICompatible, isAiConfigured } from "./provider";
import type { ChatbotApiResponse } from "@/types/chatbot";

const MAX_USER_LEN = 2000;

function genericFallback(lang: "en" | "ja"): ChatbotApiResponse {
  if (lang === "ja") {
    return {
      answer:
        "すぐに該当する定型回答が見つかりませんでした。**サプライヤー**・**売り&買い**・**お問い合わせ**の各ページをご確認いただくか、**お問い合わせフォーム**から詳細をお送りください。AI による詳細回答を利用する場合は、管理者が OPENAI_API_KEY を設定している必要があります。",
      sourceType: "faq",
      matchedTopic: "generic_help",
    };
  }
  return {
    answer:
      "I couldn’t match that to a specific quick answer. Browse **Suppliers**, **Marketplace**, or **Contact**, or send details via the **contact form**. For richer AI answers, the site operator needs to configure `OPENAI_API_KEY`.",
    sourceType: "faq",
    matchedTopic: "generic_help",
  };
}

/**
 * Layer A: high-confidence FAQ. Layer B: grounded AI. Off-topic and no-key paths avoid hallucinations.
 */
export async function retrieveAnswer(message: string, lang: "en" | "ja"): Promise<ChatbotApiResponse> {
  const trimmed = message.trim().slice(0, MAX_USER_LEN);
  if (!trimmed) {
    return {
      answer: lang === "ja" ? "内容を入力して送信してください。" : "Please type a question and send.",
      sourceType: "faq",
      matchedTopic: "generic_help",
    };
  }

  const faq = matchFaq(trimmed, lang);
  if (faq.hit && faq.answer && faq.topic) {
    return {
      answer: faq.answer,
      sourceType: "faq",
      matchedTopic: faq.topic,
    };
  }

  if (!hasSiteAnchor(trimmed)) {
    return {
      answer: getOffTopicReply(lang),
      sourceType: "faq",
      matchedTopic: "off_topic",
    };
  }

  if (!isAiConfigured()) {
    return genericFallback(lang);
  }

  const snippets = selectContextSnippets(trimmed, lang);
  const system = buildSystemPrompt({
    lang,
    knowledgeSnippets: snippets,
    hintTopic: faq.score > 0 ? faq.bestTopic : undefined,
  });

  try {
    const answer = await callOpenAICompatible({
      messages: [
        { role: "system", content: system },
        { role: "user", content: trimmed },
      ],
      maxTokens: 512,
      temperature: 0.25,
    });

    const off = getOffTopicReply(lang);
    if (answer.trim() === off.trim()) {
      return { answer: off, sourceType: "faq", matchedTopic: "off_topic" };
    }

    return {
      answer,
      sourceType: "ai",
      matchedTopic: faq.bestTopic,
    };
  } catch {
    return genericFallback(lang);
  }
}
