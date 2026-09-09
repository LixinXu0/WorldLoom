import hashlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import urllib.request

from copy import deepcopy
from http.server import (
    BaseHTTPRequestHandler,
    ThreadingHTTPServer,
)
from pathlib import Path
from urllib.parse import unquote, urlparse

from PIL import Image, ImageDraw


HOST = "127.0.0.1"
PORT = 4318

BRIDGE_DIRECTORY = Path(__file__).resolve().parent

GODOT_PROJECT_PATH = Path(
    os.environ.get(
        "WORLDLOOM_GODOT_PROJECT_PATH",
        BRIDGE_DIRECTORY / "godot-project",
    )
).expanduser().resolve()


def find_godot_executable() -> Path | None:
    configured = os.environ.get(
        "WORLDLOOM_GODOT_EXECUTABLE"
    )

    if configured:
        return Path(configured).expanduser().resolve()

    discovered = (
        shutil.which("godot4")
        or shutil.which("godot")
    )

    return (
        Path(discovered).resolve()
        if discovered
        else None
    )


GODOT_EXECUTABLE = find_godot_executable()

MAP_OUTPUT_PATH = (
    GODOT_PROJECT_PATH
    / "worldloom-godot-map.json"
)

PLAN_OUTPUT_PATH = (
    GODOT_PROJECT_PATH
    / "worldloom-generation-plan.json"
)

CONTRACT_OUTPUT_PATH = (
    GODOT_PROJECT_PATH
    / "worldloom-generation-contract.json"
)

VALIDATION_OUTPUT_PATH = (
    GODOT_PROJECT_PATH
    / "worldloom-gameplay-validation.json"
)

REGENERATION_SCOPE_OUTPUT_PATH = (
    GODOT_PROJECT_PATH
    / "worldloom-regeneration-scope.json"
)

MANIFEST_PATH = (
    GODOT_PROJECT_PATH
    / "worldloom_assets"
    / "asset_manifest.json"
)

WEB_MANIFEST_PATH = (
    BRIDGE_DIRECTORY.parent
    / "public"
    / "worldloom_assets"
    / "asset_manifest.json"
)

GENERATED_ASSET_DIRECTORY = (
    GODOT_PROJECT_PATH
    / "worldloom_assets"
    / "generated"
)

TEXTURE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}


class WorldloomBridgeHandler(
    BaseHTTPRequestHandler
):
    def send_json(
        self,
        status_code: int,
        payload: dict,
    ) -> None:
        body = json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status_code)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Access-Control-Allow-Origin",
            "*",
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS",
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )
        self.send_header(
            "Content-Length",
            str(len(body)),
        )
        self.end_headers()
        self.wfile.write(body)

    def send_file(
        self,
        status_code: int,
        file_path: Path,
    ) -> None:
        body = file_path.read_bytes()

        file_type = (
            mimetypes.guess_type(
                file_path.name
            )[0]
            or "application/octet-stream"
        )

        self.send_response(status_code)
        self.send_header(
            "Content-Type",
            file_type,
        )
        self.send_header(
            "Access-Control-Allow-Origin",
            "*",
        )
        self.send_header(
            "Cache-Control",
            "no-store, max-age=0",
        )
        self.send_header(
            "Content-Length",
            str(len(body)),
        )
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_json(
            200,
            {"ok": True},
        )

    def do_GET(self) -> None:
        try:
            if self.path == "/asset-manifest":
                validate_local_paths(
                    require_executable=False
                )

                self.send_json(
                    200,
                    scan_godot_textures(),
                )
                return

            prefix = "/asset-preview/"

            if self.path.startswith(prefix):
                asset_id = unquote(
                    self.path[len(prefix):]
                )

                self.send_file(
                    200,
                    get_asset_preview_path(
                        asset_id
                    ),
                )
                return

            self.send_json(
                404,
                {
                    "error":
                        "Unknown bridge endpoint."
                },
            )

        except FileNotFoundError as error:
            self.send_json(
                404,
                {"error": str(error)},
            )

        except Exception as error:
            self.send_json(
                500,
                {
                    "error":
                        "Cannot read Godot assets.",
                    "details": str(error),
                },
            )

    def do_POST(self) -> None:
        if self.path != "/generate":
            self.send_json(
                404,
                {
                    "error":
                        "Unknown bridge endpoint."
                },
            )
            return

        try:
            content_length = int(
                self.headers.get(
                    "Content-Length",
                    "0",
                )
            )

            if content_length <= 0:
                raise ValueError(
                    "Request body is empty."
                )

            if content_length > 10_000_000:
                self.send_json(
                    413,
                    {
                        "error":
                            "Request body is too large."
                    },
                )
                return

            request_data = json.loads(
                self.rfile.read(
                    content_length
                ).decode("utf-8")
            )

            map_data = request_data.get(
                "map"
            )

            generation_plan = (
                request_data.get("plan")
                or request_data.get(
                    "generationPlan"
                )
            )

            generated_assets = (
                request_data.get(
                    "generatedAssets",
                    [],
                )
            )

            if not isinstance(
                map_data,
                dict,
            ):
                raise ValueError(
                    "Map data is missing."
                )

            if not isinstance(
                generation_plan,
                dict,
            ):
                raise ValueError(
                    "Generation plan is missing."
                )

            if not isinstance(
                generated_assets,
                list,
            ):
                raise ValueError(
                    "Generated assets must be an array."
                )

            generation_contract = (
                request_data.get(
                    "generationContract"
                )
            )

            if generation_contract is None:
                generation_contract = (
                    map_data.get(
                        "generationContract"
                    )
                )

            validation = request_data.get(
                "validation"
            )

            if validation is None:
                validation = map_data.get(
                    "validation"
                )

            regeneration_scope = (
                normalize_regeneration_scope(
                    request_data.get(
                        "regenerationScope"
                    ),
                    map_data,
                    generation_contract,
                )
            )

            validate_local_paths()
            scan_godot_textures()

            saved_assets = (
                save_generated_assets(
                    generated_assets
                )
            )

            resolved_plan = (
                resolve_generation_plan(
                    generation_plan,
                    generated_assets,
                    map_data,
                )
            )

            map_data = deepcopy(
                map_data
            )

            map_data[
                "generationContract"
            ] = generation_contract

            map_data[
                "validation"
            ] = validation

            map_data[
                "regenerationScope"
            ] = regeneration_scope

            resolved_plan[
                "generationContract"
            ] = generation_contract

            resolved_plan[
                "validation"
            ] = validation

            resolved_plan[
                "regenerationScope"
            ] = regeneration_scope

            resolved_plan[
                "generationMode"
            ] = regeneration_scope[
                "mode"
            ]

            write_json(
                MAP_OUTPUT_PATH,
                map_data,
            )

            write_json(
                PLAN_OUTPUT_PATH,
                resolved_plan,
            )

            write_json(
                CONTRACT_OUTPUT_PATH,
                generation_contract
                if isinstance(
                    generation_contract,
                    dict,
                )
                else {},
            )

            write_json(
                VALIDATION_OUTPUT_PATH,
                validation
                if isinstance(
                    validation,
                    dict,
                )
                else {},
            )

            write_json(
                REGENERATION_SCOPE_OUTPUT_PATH,
                regeneration_scope,
            )

            print(
                "Worldloom generation mode:",
                regeneration_scope["mode"],
            )

            if (
                regeneration_scope["mode"]
                == "local"
            ):
                print(
                    "Local regeneration scope:",
                    json.dumps(
                        regeneration_scope,
                        ensure_ascii=False,
                    ),
                )

            import_godot_resources()
            run_generation()

            self.send_json(
                200,
                {
                    "ok": True,

                    "message":
                        (
                            "Worldloom local scene "
                            "regenerated."
                            if regeneration_scope[
                                "mode"
                            ] == "local"
                            else
                            "Worldloom scene generated."
                        ),

                    "scenePath":
                        "res://generated/"
                        "worldloom_generated_map.tscn",

                    "savedAssets":
                        saved_assets,

                    "mode":
                        regeneration_scope[
                            "mode"
                        ],

                    "regenerationScope":
                        regeneration_scope,
                },
            )

        except subprocess.TimeoutExpired:
            self.send_json(
                500,
                {
                    "error":
                        "Godot generation timed out."
                },
            )

        except subprocess.CalledProcessError as error:
            self.send_json(
                500,
                {
                    "error":
                        "Godot scene generation failed.",
                    "details":
                        error.stderr
                        or error.stdout
                        or "Unknown Godot error.",
                },
            )

        except Exception as error:
            self.send_json(
                500,
                {
                    "error":
                        "Worldloom bridge failed.",
                    "details": str(error),
                },
            )

    def log_message(
        self,
        message_format: str,
        *args,
    ) -> None:
        print(
            "[Worldloom Bridge] "
            + message_format % args
        )


def read_json(
    path: Path,
) -> dict:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def write_json(
    path: Path,
    data: dict,
) -> None:
    path.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def normalize_regeneration_scope(
    request_scope,
    map_data: dict,
    generation_contract,
) -> dict:
    scope = request_scope

    if not isinstance(scope, dict):
        scope = map_data.get(
            "regenerationScope"
        )

    if (
        not isinstance(scope, dict)
        and isinstance(
            generation_contract,
            dict,
        )
    ):
        scope = generation_contract.get(
            "regeneration"
        )

    if not isinstance(scope, dict):
        scope = {}

    mode = scope.get(
        "mode",
        "full",
    )

    if mode not in (
        "full",
        "local",
    ):
        raise ValueError(
            "Regeneration mode must be "
            "'full' or 'local'."
        )

    def string_list(
        key: str,
    ) -> list[str]:
        value = scope.get(
            key,
            [],
        )

        if not isinstance(
            value,
            list,
        ):
            return []

        return [
            str(item)
            for item in value
            if item is not None
        ]

    return {
        "mode":
            mode,

        "targetElementIds":
            string_list(
                "targetElementIds"
            ),

        "targetGameplayNodeIds":
            string_list(
                "targetGameplayNodeIds"
            ),

        "lockedElementIds":
            string_list(
                "lockedElementIds"
            ),

        "lockedGameplayNodeIds":
            string_list(
                "lockedGameplayNodeIds"
            ),

        "targetRoomIds":
            string_list(
                "targetRoomIds"
            ),

        "targetEdgeIds":
            string_list(
                "targetEdgeIds"
            ),
    }


def validate_local_paths(
    require_executable: bool = True,
) -> None:
    if not GODOT_PROJECT_PATH.exists():
        raise FileNotFoundError(
            "Godot project path does not exist."
        )

    if not (
        GODOT_PROJECT_PATH / "project.godot"
    ).is_file():
        raise FileNotFoundError(
            "Godot project.godot file does not exist."
        )

    if require_executable and (
        GODOT_EXECUTABLE is None
        or not GODOT_EXECUTABLE.is_file()
    ):
        raise FileNotFoundError(
            "Godot executable was not found. Set "
            "WORLDLOOM_GODOT_EXECUTABLE or add Godot "
            "to PATH."
        )

    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(
            "Godot asset manifest does not exist."
        )


def sanitize_asset_id(
    asset_id: str,
) -> str:
    result = re.sub(
        r"[^a-zA-Z0-9_-]",
        "_",
        asset_id,
    ).strip("_")

    if not result:
        raise ValueError(
            "Generated asset ID is invalid."
        )

    return result


def make_preview_url(
    asset_id: str,
) -> str:
    return (
        f"http://{HOST}:{PORT}"
        f"/asset-preview/{asset_id}"
    )


def make_texture_asset_id(
    relative_path: Path,
) -> str:
    name = sanitize_asset_id(
        relative_path.stem.lower()
    )

    path_hash = hashlib.sha1(
        relative_path
        .as_posix()
        .encode("utf-8")
    ).hexdigest()[:8]

    return (
        f"godot_texture_"
        f"{name}_{path_hash}"
    )


def infer_texture_category(
    relative_path: Path,
) -> str:
    text = (
        relative_path
        .as_posix()
        .lower()
    )

    groups = [
        (
            "terrain",
            (
                "terrain",
                "ground",
                "floor",
                "tile",
                "地面",
                "地形",
            ),
        ),
        (
            "path",
            (
                "path",
                "road",
                "rail",
                "道路",
                "路径",
            ),
        ),
        (
            "character",
            (
                "character",
                "player",
                "npc",
                "enemy",
                "角色",
                "敌人",
            ),
        ),
        (
            "building",
            (
                "building",
                "house",
                "tower",
                "建筑",
                "房屋",
            ),
        ),
        (
            "obstacle",
            (
                "wall",
                "rock",
                "barrier",
                "障碍",
                "墙",
            ),
        ),
    ]

    for category, terms in groups:
        if any(
            term in text
            for term in terms
        ):
            return category

    return "object"


def is_scannable_texture(
    path: Path,
) -> bool:
    if (
        path.suffix.lower()
        not in TEXTURE_EXTENSIONS
    ):
        return False

    relative_path = path.relative_to(
        GODOT_PROJECT_PATH
    )

    parts = tuple(
        part.lower()
        for part in relative_path.parts
    )

    if ".godot" in parts:
        return False

    return parts[:2] != (
        "worldloom_assets",
        "generated",
    )


def build_texture_manifest_asset(
    path: Path,
) -> dict:
    relative_path = path.relative_to(
        GODOT_PROJECT_PATH
    )

    asset_id = make_texture_asset_id(
        relative_path
    )

    category = infer_texture_category(
        relative_path
    )

    name = re.sub(
        r"[_-]+",
        " ",
        relative_path.stem,
    ).strip().title()

    tags = [
        tag.lower()
        for tag in re.split(
            r"[^a-zA-Z0-9\u4e00-\u9fff]+",
            relative_path
            .with_suffix("")
            .as_posix(),
        )
        if tag
    ]

    layer = {
        "terrain": 0,
        "path": 1,
        "character": 3,
    }.get(category, 2)

    return {
        "id": asset_id,
        "name": name or asset_id,
        "category": category,
        "tags": list(
            dict.fromkeys(
                tags + [category]
            )
        ),
        "origin": "godot_texture",
        "previewUrl":
            make_preview_url(asset_id),
        "resource": {
            "type": "texture",
            "path":
                "res://"
                + relative_path.as_posix(),
        },
        "visual": {
            "defaultWidth": 128,
            "defaultHeight": 128,
        },
        "placement": {
            "mode":
                "center_in_bounds",
            "layer": layer,
        },
        "physics": {
            "collision": False,
            "bodyType": "static",
        },
    }


def add_preview_urls(
    assets: list,
) -> None:
    for asset in assets:
        if not isinstance(asset, dict):
            continue

        resource = asset.get(
            "resource",
            {},
        )

        if (
            isinstance(resource, dict)
            and resource.get("type")
            == "texture"
        ):
            asset_id = str(
                asset.get("id", "")
            )

            if asset_id:
                asset["previewUrl"] = (
                    make_preview_url(
                        asset_id
                    )
                )


def scan_godot_textures() -> dict:
    manifest = read_json(
        MANIFEST_PATH
    )

    assets = manifest.get(
        "assets",
        [],
    )

    if not isinstance(assets, list):
        raise ValueError(
            "Asset manifest assets field is invalid."
        )

    if not assets and WEB_MANIFEST_PATH.is_file():
        web_manifest = read_json(
            WEB_MANIFEST_PATH
        )
        web_assets = web_manifest.get(
            "assets",
            [],
        )

        if isinstance(web_assets, list):
            assets = deepcopy(web_assets)
            manifest.update({
                "schemaVersion": web_manifest.get(
                    "schemaVersion",
                    manifest.get("schemaVersion", "1.0"),
                ),
                "libraryId": web_manifest.get(
                    "libraryId",
                    manifest.get("libraryId", "worldloom-local"),
                ),
                "name": web_manifest.get(
                    "name",
                    manifest.get("name", "Worldloom Local Assets"),
                ),
            })

    retained_assets = [
        asset
        for asset in assets
        if (
            not isinstance(asset, dict)
            or asset.get("origin")
            != "godot_texture"
        )
    ]

    texture_assets = [
        build_texture_manifest_asset(path)
        for path in sorted(
            GODOT_PROJECT_PATH.rglob("*")
        )
        if (
            path.is_file()
            and is_scannable_texture(path)
        )
    ]

    all_assets = (
        retained_assets
        + texture_assets
    )

    add_preview_urls(all_assets)

    manifest["assets"] = all_assets

    write_json(
        MANIFEST_PATH,
        manifest,
    )

    print(
        "Worldloom found ",
        len(texture_assets),
        " reusable Godot textures",
    )

    return manifest


def resource_path_to_local(
    resource_path: str,
) -> Path:
    if not resource_path.startswith(
        "res://"
    ):
        raise ValueError(
            "Invalid Godot resource path."
        )

    root = GODOT_PROJECT_PATH.resolve()

    path = (
        root
        / resource_path[len("res://"):]
    ).resolve()

    if (
        path != root
        and root not in path.parents
    ):
        raise ValueError(
            "Texture path leaves the project."
        )

    return path


def get_asset_preview_path(
    asset_id: str,
) -> Path:
    manifest = scan_godot_textures()

    for asset in manifest.get(
        "assets",
        [],
    ):
        if not isinstance(asset, dict):
            continue

        if (
            str(asset.get("id", ""))
            != asset_id
        ):
            continue

        resource = asset.get(
            "resource",
            {},
        )

        if not isinstance(resource, dict):
            break

        if (
            resource.get("type")
            != "texture"
        ):
            break

        path = resource_path_to_local(
            str(
                resource.get(
                    "path",
                    "",
                )
            )
        )

        if (
            path.is_file()
            and path.suffix.lower()
            in TEXTURE_EXTENSIONS
        ):
            return path

        break

    raise FileNotFoundError(
        "Texture preview was not found."
    )


def validate_image_url(
    image_url: str,
) -> None:
    parsed = urlparse(image_url)

    hostname = (
        parsed.hostname
        or ""
    ).lower()

    if parsed.scheme != "https":
        raise ValueError(
            "Generated image URL must use HTTPS."
        )

    if not (
        hostname == "aliyuncs.com"
        or hostname.endswith(
            ".aliyuncs.com"
        )
    ):
        raise ValueError(
            "Generated image URL is not from Aliyun."
        )


def download_image(
    image_url: str,
    output_path: Path,
) -> None:
    validate_image_url(image_url)

    request = urllib.request.Request(
        image_url,
        headers={
            "User-Agent":
                "WorldloomBridge/1.0",
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=60,
    ) as response:
        image_data = response.read(
            20_000_001
        )

    if len(image_data) > 20_000_000:
        raise ValueError(
            "Generated image is too large."
        )

    if not image_data.startswith(
        b"\x89PNG\r\n\x1a\n"
    ):
        raise ValueError(
            "Generated asset is not a PNG image."
        )

    output_path.write_bytes(image_data)


def should_remove_background(
    category: str,
) -> bool:
    return (
        category.strip().lower()
        != "map_background"
    )


def corner_is_background(
    pixel: tuple,
) -> bool:
    red, green, blue, alpha = pixel

    return (
        alpha > 0
        and min(
            red,
            green,
            blue,
        ) >= 215
        and (
            max(red, green, blue)
            - min(red, green, blue)
        ) <= 45
    )


def process_generated_image(
    image_path: Path,
    category: str,
) -> dict:
    with Image.open(
        image_path
    ) as source:
        image = source.convert("RGBA")

    original_width = image.width
    original_height = image.height

    background_removed = False
    cropped = False

    if should_remove_background(
        category
    ):
        corners = [
            (0, 0),
            (image.width - 1, 0),
            (0, image.height - 1),
            (
                image.width - 1,
                image.height - 1,
            ),
        ]

        for corner in corners:
            pixel = image.getpixel(
                corner
            )

            if corner_is_background(
                pixel
            ):
                ImageDraw.floodfill(
                    image,
                    corner,
                    (
                        pixel[0],
                        pixel[1],
                        pixel[2],
                        0,
                    ),
                    thresh=45,
                )

                background_removed = True

        bounding_box = (
            image
            .getchannel("A")
            .getbbox()
        )

        if bounding_box:
            content = image.crop(
                bounding_box
            )

            padding = max(
                4,
                round(
                    max(
                        content.width,
                        content.height,
                    )
                    * 0.04
                ),
            )

            result = Image.new(
                "RGBA",
                (
                    content.width
                    + padding * 2,
                    content.height
                    + padding * 2,
                ),
                (0, 0, 0, 0),
            )

            result.paste(
                content,
                (padding, padding),
                content,
            )

            image = result

            cropped = (
                image.width < original_width
                or image.height
                < original_height
            )

    image.thumbnail(
        (1024, 1024),
        Image.Resampling.LANCZOS,
    )

    image.save(
        image_path,
        format="PNG",
        optimize=True,
    )

    return {
        "originalPixelWidth":
            original_width,
        "originalPixelHeight":
            original_height,
        "processedPixelWidth":
            image.width,
        "processedPixelHeight":
            image.height,
        "backgroundRemoved":
            background_removed,
        "cropped":
            cropped,
    }


def save_generated_assets(
    generated_assets: list,
) -> list[str]:
    if not generated_assets:
        return []

    GENERATED_ASSET_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    manifest = read_json(
        MANIFEST_PATH
    )

    assets = manifest.get(
        "assets",
        [],
    )

    if not isinstance(assets, list):
        raise ValueError(
            "Asset manifest assets field is invalid."
        )

    saved_paths = []

    for generated_asset in generated_assets:
        if not isinstance(
            generated_asset,
            dict,
        ):
            continue

        asset_id = sanitize_asset_id(
            str(
                generated_asset.get(
                    "assetId",
                    "",
                )
            )
        )

        image_url = str(
            generated_asset.get(
                "imageUrl",
                "",
            )
        )

        if not image_url:
            raise ValueError(
                f"Generated asset "
                f"{asset_id} has no image URL."
            )

        category = str(
            generated_asset.get(
                "category",
                "object",
            )
        )

        filename = f"{asset_id}.png"

        local_path = (
            GENERATED_ASSET_DIRECTORY
            / filename
        )

        download_image(
            image_url,
            local_path,
        )

        processing = (
            process_generated_image(
                local_path,
                category,
            )
        )

        resource_path = (
            "res://worldloom_assets/"
            f"generated/{filename}"
        )

        size = generated_asset.get(
            "size",
            {},
        )

        if not isinstance(size, dict):
            size = {}

        is_background = (
            category.strip().lower()
            == "map_background"
        )

        new_asset = {
            "id": asset_id,
            "name": str(
                generated_asset.get(
                    "name",
                    asset_id,
                )
            ),
            "category": category,
            "tags": [
                asset_id,
                "generated",
                "ai_generated",
                category,
            ],
            "origin": "ai_generated",
            "previewUrl":
                make_preview_url(asset_id),
            "resource": {
                "type": "texture",
                "path": resource_path,
            },
            "visual": {
                "defaultWidth": max(
                    1,
                    float(
                        size.get(
                            "width",
                            128,
                        )
                    ),
                ),
                "defaultHeight": max(
                    1,
                    float(
                        size.get(
                            "height",
                            128,
                        )
                    ),
                ),
                **processing,
            },
            "placement": {
                "mode": (
                    "stretch_to_bounds"
                    if is_background
                    else "center_in_bounds"
                ),
                "layer": (
                    -10
                    if is_background
                    else int(
                        generated_asset.get(
                            "layer",
                            1,
                        )
                    )
                ),
            },
            "physics": {
                "collision": (
                    False
                    if is_background
                    else bool(
                        generated_asset.get(
                            "collision",
                            False,
                        )
                    )
                ),
                "bodyType": "static",
            },
        }

        assets = [
            asset
            for asset in assets
            if (
                not isinstance(asset, dict)
                or asset.get("id")
                != asset_id
            )
        ]

        assets.append(new_asset)
        saved_paths.append(
            resource_path
        )

    manifest["assets"] = assets
    add_preview_urls(assets)

    write_json(
        MANIFEST_PATH,
        manifest,
    )

    return saved_paths


def resolve_generation_plan(
    generation_plan: dict,
    generated_assets: list,
    map_data: dict,
) -> dict:
    result = deepcopy(
        generation_plan
    )

    placements = result.get(
        "placements",
        [],
    )

    missing_assets = result.get(
        "missingAssets",
        [],
    )

    map_elements = map_data.get(
        "elements",
        [],
    )

    if not isinstance(placements, list):
        placements = []

    if not isinstance(
        missing_assets,
        list,
    ):
        missing_assets = []

    if not isinstance(
        map_elements,
        list,
    ):
        map_elements = []

    elements_by_id = {
        str(element.get("id", "")):
            element

        for element in map_elements

        if isinstance(element, dict)
    }

    generated_request_ids = set()

    for generated_asset in generated_assets:
        if not isinstance(
            generated_asset,
            dict,
        ):
            continue

        request_id = str(
            generated_asset.get(
                "requestId",
                "",
            )
        )

        source_element_id = str(
            generated_asset.get(
                "sourceElementId",
                "",
            )
        )

        asset_id = sanitize_asset_id(
            str(
                generated_asset.get(
                    "assetId",
                    "",
                )
            )
        )

        category = str(
            generated_asset.get(
                "category",
                "object",
            )
        ).strip().lower()

        is_background = (
            category
            == "map_background"
        )

        generated_request_ids.add(
            request_id
        )

        source_element = (
            elements_by_id.get(
                source_element_id,
                {},
            )
        )

        position = source_element.get(
            "position",
            {},
        )

        bounds = source_element.get(
            "bounds",
            {},
        )

        requested_size = (
            generated_asset.get(
                "size",
                {},
            )
        )

        if not isinstance(position, dict):
            position = {}

        if not isinstance(bounds, dict):
            bounds = {}

        if not isinstance(
            requested_size,
            dict,
        ):
            requested_size = {}

        if is_background:
            canvas = map_data.get(
                "canvas",
                {},
            )

            if not isinstance(canvas, dict):
                canvas = {}

            width = float(
                canvas.get(
                    "width",
                    requested_size.get(
                        "width",
                        960,
                    ),
                )
            )

            height = float(
                canvas.get(
                    "height",
                    requested_size.get(
                        "height",
                        560,
                    ),
                )
            )

            position = {
                "x": width / 2.0,
                "y": height / 2.0,
            }

        else:
            width = float(
                bounds.get(
                    "width",
                    requested_size.get(
                        "width",
                        128,
                    ),
                )
            )

            height = float(
                bounds.get(
                    "height",
                    requested_size.get(
                        "height",
                        128,
                    ),
                )
            )

        placements.append(
            {
                "id":
                    f"generated-placement-"
                    f"{asset_id}",
                "sourceElementId":
                    source_element_id,
                "assetId": asset_id,
                "rationale": (
                    "AI-generated overall "
                    "map background."
                    if is_background
                    else
                    "AI-generated because no "
                    "suitable library asset "
                    "was available."
                ),
                "position": {
                    "x": float(
                        position.get(
                            "x",
                            0,
                        )
                    ),
                    "y": float(
                        position.get(
                            "y",
                            0,
                        )
                    ),
                },
                "size": {
                    "width":
                        max(1, width),
                    "height":
                        max(1, height),
                },
                "rotation": 0,
                "layer": (
                    -10
                    if is_background
                    else int(
                        generated_asset.get(
                            "layer",
                            1,
                        )
                    )
                ),
                "collision": (
                    False
                    if is_background
                    else bool(
                        generated_asset.get(
                            "collision",
                            False,
                        )
                    )
                ),
            }
        )

    result["schemaVersion"] = "1.1"
    result["placements"] = placements

    result["missingAssets"] = [
        request
        for request in missing_assets
        if (
            not isinstance(request, dict)
            or str(
                request.get(
                    "id",
                    "",
                )
            )
            not in generated_request_ids
        )
    ]

    return result


def run_godot_command(
    command: list[str],
    timeout: int,
) -> None:
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        errors="backslashreplace",
        timeout=timeout,
        check=False,
    )

    if result.stdout:
        print(result.stdout)

    if result.stderr:
        print(result.stderr)

    if result.returncode != 0:
        raise subprocess.CalledProcessError(
            result.returncode,
            command,
            output=result.stdout,
            stderr=result.stderr,
        )


def import_godot_resources() -> None:
    print(
        "Waiting for Godot to import "
        "new texture resources..."
    )

    run_godot_command(
        [
            str(GODOT_EXECUTABLE),
            "--headless",
            "--path",
            str(GODOT_PROJECT_PATH),
            "--import",
        ],
        timeout=120,
    )


def run_generation() -> None:
    run_godot_command(
        [
            str(GODOT_EXECUTABLE),
            "--headless",
            "--path",
            str(GODOT_PROJECT_PATH),
            "res://worldloom_map.tscn",
            "--quit-after",
            "3",
        ],
        timeout=60,
    )

    subprocess.Popen(
        [
            str(GODOT_EXECUTABLE),
            "--editor",
            "--path",
            str(GODOT_PROJECT_PATH),
            "res://generated/"
            "worldloom_generated_map.tscn",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    os.chdir(
        Path(__file__)
        .resolve()
        .parent
    )

    server = ThreadingHTTPServer(
        (HOST, PORT),
        WorldloomBridgeHandler,
    )

    print(
        f"Worldloom Bridge running at "
        f"http://{HOST}:{PORT}"
    )

    print(
        f"Godot project: "
        f"{GODOT_PROJECT_PATH}"
    )

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print(
            "\nWorldloom Bridge stopped."
        )

    finally:
        server.server_close()


if __name__ == "__main__":
    main()
