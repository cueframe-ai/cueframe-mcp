#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

usage() {
  echo "usage: motion-grid.sh INPUT OUTPUT_DIR [--overview-fps N] [--dense-fps N] [--start SEC] [--duration SEC]" >&2
  exit 2
}

[[ $# -ge 2 ]] || usage
input=$1
output_dir=$2
shift 2
overview_fps=1
dense_fps=6
start_sec=0
duration_sec=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --overview-fps) [[ $# -ge 2 ]] || usage; overview_fps=$2; shift 2 ;;
    --dense-fps) [[ $# -ge 2 ]] || usage; dense_fps=$2; shift 2 ;;
    --start) [[ $# -ge 2 ]] || usage; start_sec=$2; shift 2 ;;
    --duration) [[ $# -ge 2 ]] || usage; duration_sec=$2; shift 2 ;;
    *) usage ;;
  esac
done
awk -v a="$overview_fps" -v b="$dense_fps" -v s="$start_sec" -v d="$duration_sec" 'BEGIN {
  number = "^[0-9]+([.][0-9]+)?$"
  exit !(a ~ number && a > 0 && b ~ number && b > 0 && s ~ number && (d == "" || (d ~ number && d > 0)))
}' || usage
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe is required" >&2; exit 1; }
[[ -f "$input" ]] || { echo "input not found: $input" >&2; exit 1; }
mkdir -p "$output_dir"
for label in overview dense; do
  [[ ! -e "$output_dir/${label}-index.tsv" && ! -e "$output_dir/${label}-001.jpg" ]] || {
    echo "use a fresh output directory (existing $label grid)" >&2; exit 1;
  }
done
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/cueframe-motion-grid.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT

ffprobe -v error \
  -show_entries format=duration,format_name:stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,time_base,start_time,sample_rate,channels \
  -of json "$input" > "$output_dir/probe.json"
# ffprobe emits frames in presentation order, matching FFmpeg select's n on
# the first video stream. Keep their actual timestamps, including VFR timing.
ffprobe -v error -select_streams v:0 -show_frames \
  -show_entries frame=best_effort_timestamp,best_effort_timestamp_time \
  -of compact "$input" > "$work_dir/frames.txt"
awk -F '|' '
  $1 == "frame" {
    pts = ""; seconds = ""
    for (i = 2; i <= NF; i++) {
      split($i, field, "=")
      if (field[1] == "best_effort_timestamp") pts = field[2]
      if (field[1] == "best_effort_timestamp_time") seconds = field[2]
    }
    if (pts !~ /^-?[0-9]+$/ || seconds !~ /^-?[0-9]+([.][0-9]+)?$/) exit 1
    if (n && seconds + 0 < previous) exit 1
    printf "%d\t%s\t%s\n", n++, pts, seconds
    previous = seconds + 0
  }
  END { if (!n) exit 1 }
' "$work_dir/frames.txt" > "$work_dir/frames.tsv" || {
  echo "source has missing or nonmonotonic presentation timestamps" >&2; exit 1;
}
ffmpeg -hide_banner -filters > "$work_dir/filters.txt" 2>/dev/null
has_drawtext=0
if grep -q ' drawtext ' "$work_dir/filters.txt"; then has_drawtext=1; fi

make_grid() {
  local label=$1 rate=$2 filter
  # Select the first actual source frame at/after each requested instant, once.
  # Start/duration are relative to the first presented frame; the end is exclusive.
  awk -F '\t' -v rate="$rate" -v start="$start_sec" -v duration="$duration_sec" '
    BEGIN { print "page\tcell\ttime_sec\tsource_frame\tsource_pts\tsource_pts_time_sec\ttarget_time_sec"; target = start }
    NR == 1 { origin = $3 + 0 }
    {
      time = $3 - origin
      if (duration != "" && time >= start + duration - 0.0000005) next
      if (time + 0.0000005 < target) next
      printf "%03d\t%02d\t%.6f\t%s\t%s\t%s\t%.6f\n", int(count / 16) + 1, count % 16 + 1, time, $1, $2, $3, target
      count++
      target = start + (int((time - start + 0.0000005) * rate) + 1) / rate
    }
    END { if (!count) exit 1 }
  ' "$work_dir/frames.tsv" > "$work_dir/${label}-index.tsv" || {
    echo "no source frames in the requested interval" >&2; return 1;
  }
  awk -F '\t' 'NR > 1 { printf "%seq(n\\,%s)", separator, $4; separator = "+" }' \
    "$work_dir/${label}-index.tsv" > "$work_dir/selection.txt"
  filter="select='$(cat "$work_dir/selection.txt")',scale=384:-2:flags=lanczos"
  if [[ "$has_drawtext" -eq 1 ]]; then
    filter="${filter},drawtext=fontcolor=white:fontsize=20:box=1:boxcolor=black@0.72:x=8:y=h-th-8:text='pts=%{pts\\:flt}'"
  fi
  filter="${filter},tile=4x4:padding=8:margin=8:color=0x111827"
  # No seek/fps filter: neither source frame indices nor timestamps are relabeled.
  ffmpeg -hide_banner -loglevel error -copyts -i "$input" -map 0:v:0 \
    -vf "$filter" -fps_mode passthrough -q:v 2 \
    "$output_dir/${label}-%03d.jpg"
  cp "$work_dir/${label}-index.tsv" "$output_dir/${label}-index.tsv"
}
make_grid overview "$overview_fps"
make_grid dense "$dense_fps"
echo "wrote probe.json, grids and actual source-frame/PTS indices to $output_dir"
