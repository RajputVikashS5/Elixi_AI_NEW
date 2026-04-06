import unittest

from emotion_engine.response_modulator import ResponseModulator
from intent_engine.prompt_builder import PromptBuilder
from models.schemas import EmotionContext


class ResponseModulatorTests(unittest.TestCase):
    def test_response_contract_contains_required_sections(self) -> None:
        modulator = ResponseModulator()

        contract = modulator.response_contract("frustrated")

        self.assertIn("Emotion Response Contract:", contract)
        self.assertIn("Required opening style", contract)
        self.assertIn("Response formatting rule", contract)
        self.assertIn("Avoid mentioning confidence scores", contract)


class PromptBuilderTests(unittest.TestCase):
    def test_build_system_prompt_includes_neutral_contract_without_emotion(self) -> None:
        builder = PromptBuilder()

        prompt = builder.build_system_prompt(personality_mode="friendly", emotion_context=None)

        self.assertIn("Emotion Response Contract:", prompt)
        self.assertIn("Got it. | Here is the best next step.", prompt)

    def test_build_system_prompt_includes_emotion_guidance_when_stressed(self) -> None:
        builder = PromptBuilder()

        prompt = builder.build_system_prompt(
            personality_mode="friendly",
            emotion_context=EmotionContext(state="stressed", confidence=0.82),
        )

        self.assertIn("Empathetic response guidance", prompt)
        self.assertIn("emotion confidence: 0.82", prompt)
        self.assertIn("stressed", prompt)
        self.assertIn("The user appears stressed", prompt)


if __name__ == "__main__":
    unittest.main()
