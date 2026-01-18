.PHONY: setup setup-all sync check test help clean

help:
	@echo "AI Agents Config - Available commands:"
	@echo ""
	@echo "  make setup      - Run interactive AI assistant setup"
	@echo "  make setup-all  - Setup all AI assistants"
	@echo "  make sync       - Sync skill metadata to AGENTS.md files"
	@echo "  make check      - Check if AGENTS.md files are in sync (for CI)"
	@echo "  make test       - Run all tests"
	@echo "  make clean      - Remove generated files"
	@echo ""

setup:
	./setup.sh

setup-all:
	./setup.sh --all

sync:
	./templates/skills/skill-sync/assets/sync.sh

check:
	./templates/skills/skill-sync/assets/sync.sh --check

test:
	@echo "Running setup.sh tests..."
	./setup_test.sh
	@echo ""
	@echo "Running sync.sh tests..."
	./templates/skills/skill-sync/assets/sync_test.sh

clean:
	rm -f .cursorrules
	rm -f CLAUDE.md
	rm -f GEMINI.md
	rm -rf .claude/skills
	rm -rf .gemini/skills
	rm -rf .codex/skills
	rm -f .github/copilot-instructions.md
	@echo "Cleaned generated files"
