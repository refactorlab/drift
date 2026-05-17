from openai import OpenAI, AsyncOpenAI
from anthropic import Anthropic

# Module-scope client — negative for LLM-CLI-001.
client = OpenAI()


def client_per_request(prompts):
    """LLM-CLI-001: constructing a fresh client per loop iteration."""
    for p in prompts:
        c = OpenAI()
        c.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": p}])


def loop_completions(prompts):
    """LLM-LOOP-002: completion call in a loop with module-scope client."""
    for p in prompts:
        client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": p}])


async def sync_in_async(prompts):
    """LLM-SYNC-003: synchronous client used in an async function."""
    for p in prompts:
        client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": p}])


claude = Anthropic()


def no_cache_control():
    """LLM-CACHE-004: Anthropic system prompt without cache_control."""
    claude.messages.create(
        model="claude-3-5-sonnet-latest",
        system="You are a helpful assistant. <very long static prompt>",
        messages=[{"role": "user", "content": "hi"}],
    )
