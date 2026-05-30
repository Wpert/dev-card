clean:
    rm -rf dist/
    rm -f package-lock.json

build:
    npx run build
    cp assets/* dist/

cleanbuild: clean build

serve:
    @echo "Edit files in src/, then run 'just build'"
    @echo "Open localhost:8000 in browser"

dev: serve
    python3 -m http.server 8000 --directory dist

default:
    just build
    just dev
