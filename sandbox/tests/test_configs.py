import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ConfigTests(unittest.TestCase):
    def test_all_json_files_parse(self) -> None:
        files = list((ROOT / "configs").glob("*.json")) + list((ROOT / "mock_data").glob("*.json"))
        self.assertGreaterEqual(len(files), 6)
        for path in files:
            with self.subTest(path=path.name):
                with path.open("r", encoding="utf-8") as handle:
                    json.load(handle)

    def test_all_three_research_lines_have_ten_steps(self) -> None:
        with (ROOT / "configs" / "lines.json").open("r", encoding="utf-8") as handle:
            lines = json.load(handle)
        self.assertEqual(10, len(lines["trait"]["steps"]))
        self.assertEqual(10, len(lines["state"]["steps"]))
        self.assertEqual(10, len(lines["signal"]["steps"]))

    def test_public_chain_has_call_f01_to_f06_and_return(self) -> None:
        with (ROOT / "configs" / "public_chain.json").open("r", encoding="utf-8") as handle:
            chain = json.load(handle)
        self.assertEqual(["CALL", "F01", "F02", "F03", "F04", "F05", "F06", "RETURN"], [step["id"] for step in chain["steps"]])

    def test_tr02_every_step_has_a_realistic_mock_example(self) -> None:
        with (ROOT / "mock_data" / "tr02_run.json").open("r", encoding="utf-8") as handle:
            run = json.load(handle)
        self.assertEqual([f"T{index:02d}" for index in range(1, 11)], list(run["steps"].keys()))
        for step_id, step in run["steps"].items():
            with self.subTest(step=step_id):
                example = step["example"]
                self.assertTrue(example["case_id"])
                self.assertTrue(example["input_story"])
                self.assertGreaterEqual(len(example["calculation"]), 3)
                self.assertTrue(example["output_story"])
                self.assertGreaterEqual(len(example["sample_rows"]), 2)


if __name__ == "__main__":
    unittest.main()
