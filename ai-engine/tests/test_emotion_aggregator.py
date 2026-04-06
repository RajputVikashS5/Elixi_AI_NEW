import unittest

from emotion_engine.emotion_aggregator import EmotionAggregator


class EmotionAggregatorTests(unittest.TestCase):
    def test_update_config_clamps_values(self) -> None:
        aggregator = EmotionAggregator()

        config = aggregator.update_config(
            source_weights={"typing": 4.2, "voice": -1, "ignored": 2},
            min_confidence=1.8,
        )

        self.assertEqual(config["source_weights"]["typing"], 3.0)
        self.assertEqual(config["source_weights"]["voice"], 0.0)
        self.assertNotIn("ignored", config["source_weights"])
        self.assertEqual(config["min_confidence"], 1.0)

    def test_aggregate_uses_source_weight_and_threshold(self) -> None:
        aggregator = EmotionAggregator(
            source_weights={"typing": 1.0, "voice": 2.0},
            min_confidence=0.5,
        )

        result = aggregator.aggregate(
            [
                {"source": "typing", "state": "focused", "confidence": 0.9, "weight": 1.0},
                {"source": "voice", "state": "stressed", "confidence": 0.6, "weight": 1.0},
                {"source": "time", "state": "stressed", "confidence": 0.4, "weight": 1.0},
            ]
        )

        self.assertEqual(result["state"], "stressed")
        self.assertAlmostEqual(result["confidence"], 0.5714, places=4)
        self.assertGreaterEqual(result["signals"][0]["weighted_confidence"], result["signals"][1]["weighted_confidence"])

    def test_aggregate_returns_neutral_when_all_filtered(self) -> None:
        aggregator = EmotionAggregator(min_confidence=0.95)

        result = aggregator.aggregate(
            [
                {"source": "typing", "state": "focused", "confidence": 0.6},
                {"source": "voice", "state": "stressed", "confidence": 0.7},
            ]
        )

        self.assertEqual(result["state"], "neutral")
        self.assertEqual(result["confidence"], 0.5)


if __name__ == "__main__":
    unittest.main()
