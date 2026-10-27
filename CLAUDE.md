# CLAUDE.md — chess-review

Web app review ván cờ giống **Game Review của chess.com**, chạy **100% trên trình duyệt** (không backend, không database).
Repo mã nguồn mở công khai (Stockfish là GPL-3 → toàn bộ repo theo GPL-3).

## Tech stack
- **Vite + React + TypeScript** (strict mode)
- **chess.js**: luật cờ, parse PGN, sinh FEN sau mỗi nước
- **react-chessboard**: bàn cờ (MIT). KHÔNG dùng chessground (GPL, khác API)
- **Stockfish 19 (npm `stockfish`, WASM)**: chạy trong Web Worker. Ưu tiên tốc độ và độ mạnh:
  - Bản chính: **full NNUE đa luồng** (`stockfish-19.js` + `.wasm`, khoảng 99 MB). `Threads = hardwareConcurrency - 1`, `Hash` 128–256 MB
  - Trong lúc bản full đang tải: dùng tạm **lite đa luồng** (`stockfish-19-lite.*`, khoảng 1.7 MB), tải xong thì chuyển sang full
  - Không có `SharedArrayBuffer`: dùng **lite single-thread** (`stockfish-19-lite-single.*`)
  - Đa luồng bắt buộc header `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`: cấu hình ở `vite.config.ts` (dev/preview) và `vercel.json` (deploy)
  - **Không commit file .wasm** (gần mức giới hạn 100 MB của GitHub). Script build copy file từ `node_modules/stockfish/bin` sang `public/stockfish/`, và thư mục này nằm trong .gitignore
- **recharts**: biểu đồ eval
- **Vitest**: unit test
- Deploy: **Vercel** (GitHub Pages không đặt được header COOP/COEP nên không dùng)

## Lệnh
- `npm install`: cài đặt
- `npm run dev`: chạy dev server
- `npm run build`: build production (phải pass trước khi commit)
- `npm test`: chạy Vitest (watch). Chạy một lần: `npm test -- --run`
- `npm run lint`: oxlint

## Kiến trúc
```
src/
├── types.ts            # Ply, GameModel, Score (cp | mate | gameover), PositionEval
├── chess/              # logic thuần, có test
│   ├── parsePgn.ts     # PGN → GameModel (chỉ đường chính, bỏ biến phụ/comment)
│   ├── navigation.ts   # clampPly, fenAt, lastMoveAt, positionAt (fen + lịch sử nước cho engine)
│   ├── exploration.ts  # trạng thái xem lại + biến phụ người dùng tự đi (playMove/next/prev/exit), pure
│   ├── clocks.ts       # đồng hồ [%clk], thời gian mỗi nước, TimeControl; material.ts: quân đã ăn, +N
│   ├── pvToSan.ts      # biến chính UCI → SAN
│   ├── terminal.ts     # terminalScore(position): chiếu hết / hòa (pat, thiếu quân, lặp 3 lần, 50 nước)
│   └── samplePgn.ts    # ván mẫu cho nút "Ván mẫu"
├── engine/
│   ├── uci.ts          # parseInfo, parseBestMove, toWhitePov (pure, có test)
│   ├── formatScore.ts  # "+1.23", "M3", "1-0"...
│   ├── StockfishEngine.ts  # bọc 1 engine UCI: analyze(position kèm moves, MultiPV) → bestMove + lines; newGame; stop; terminate
│   ├── engineManager.ts    # engine LIVE: singleton getEngineManager(), Lite → Full đa luồng; holdLive() tạm dừng live
│   ├── enginePool.ts       # phân tích CẢ VÁN: N engine 1 luồng song song (FIFO, crash thì giao lại, Full lỗi thì sang Lite)
│   ├── flavors.ts      # full / lite / lite-single, threads, hash
│   ├── transport.ts    # EngineTransport (Worker); fakeTransport.ts dùng cho test
├── analysis/           # LÕI chấm điểm, pure, có test. Xem docs/scoring.md
│   ├── winPercent.ts, accuracy.ts (moveAccuracy, gameAccuracy theo lichess)
│   ├── perspective.ts  # negateScore, scoreForMover
│   ├── classifyMove.ts # Brilliant → Great → Best → theo mức tụt win%
│   ├── sacrifice.ts    # heuristic thí quân (cho Brilliant)
│   ├── reviewGame.ts   # chấm cả ván từ evals (chạy được với kết quả một phần)
│   ├── thresholds.ts, quality.ts (Nhanh/Chuẩn/Sâu), moveClassMeta.ts (nhãn VN, ký hiệu, màu)
│   ├── assessment.ts   # câu đánh giá thế cờ ("Đen ưu thế", "Trắng chiếu hết sau 3 nước"), missedMate
├── api/                # nguồn ván bên ngoài
│   ├── chessCom.ts     # type, toGameSummary (kết quả/màu người dùng), fetchJson + ChessComError (lỗi tiếng Việt)
│   ├── chessComLoader.ts # tải tuần tự từng tháng (mới → cũ), dừng khi đủ 20 ván khớp bộ lọc hoặc 6 tháng
│   └── fixtures.ts     # ván chess.com mẫu cho test
├── openings/
│   ├── openings.ts     # detectOpening (Book = nước liên tiếp từ đầu ván có EPD trong db), loadOpeningDb (lazy)
│   └── openings.json   # sinh bởi scripts/build-openings.mjs (lichess chess-openings, CC0, commit cố định). Không sửa tay
├── ai/                 # giải thích bằng Claude, gọi thẳng từ trình duyệt bằng key của người dùng
│   ├── explainPrompt.ts  # prompt chỉ chứa dữ liệu engine (pure, có test)
│   ├── claudeClient.ts   # SDK tải lười, stream, fallback, đổi lỗi sang tiếng Việt
│   └── apiKeyStore.ts    # sessionStorage mặc định, localStorage khi "nhớ"
├── training/           # chế độ "Luyện chiếu hết", pure, có test (trừ puzzles.json)
│   ├── puzzle.ts       # puzzle lichess: startPuzzle, checkMove (nước chiếu hết nào cũng đúng), opponentReply
│   ├── endgames.ts     # KQ/KR/KBB/KBN: randomEndgame (hợp lệ, Vua đen không ở mép), endgameResult (hòa = chưa đạt)
│   ├── premove.ts      # bàn ảo (virtualFen), premoveTargets (không xét quân chắn, được nhắm ô quân mình), takePremove
│   ├── session.ts      # một lần làm bài: playerMove / opponentMove (đi premove ngay khi tới lượt) / addPremove / tick
│   ├── explore.ts      # bàn phân tích sau khi làm xong bài: đi lại các nước, tự đi quân cho cả hai bên
│   ├── timer.ts, exercises.ts (loại bài, giới hạn giờ, pickTask: chỉ chọn puzzle chưa gặp, danh sách đã gặp lưu localStorage), stats.ts (chuỗi đúng, localStorage)
│   └── puzzles.json    # sinh bởi scripts/build-puzzles.mjs từ kho puzzle lichess (CC0). Không sửa tay, tải lười
├── sound/              # âm thanh nước đi tự tổng hợp bằng Web Audio (không có file âm thanh, không cần sửa CSP)
│   ├── moveSound.ts    # SAN → loại âm: move / capture / castle / check / promote / mate (pure, có test)
│   └── player.ts       # tiếng gõ quân = nhiễu trắng qua band-pass; chiếu/phong cấp/chiếu hết thêm nốt báo
├── hooks/
│   ├── useMoveSound.ts       # phát âm khi nước đang hiển thị đổi; bật/tắt lưu localStorage ở App
│   ├── useOpening.ts         # khai cuộc của ván (chờ db tải xong)
│   ├── useMoveExplanation.ts # giải thích từng nước, hủy khi đổi nước, cache theo (ván, ply)
│   ├── useChessComGames.ts   # danh sách ván theo username (abort khi đổi, chặn tải chồng)
│   ├── useGameNavigation.ts  # vị trí đang xem (ván chính hoặc biến phụ), phím ←/→/Home/End, playMove
│   ├── useVariationReview.ts # chấm nước trong biến phụ: pool nhỏ (2 engine), cache theo lịch sử nước
│   ├── useLineReview.ts      # chấm từng nước của một chuỗi nước (bài luyện tập, bàn phân tích): pool 2 engine, cache theo lịch sử
│   ├── useDropSquare.ts      # ô thả quân tính theo con trỏ + vị trí thật của bàn cờ (react-chessboard có thể dùng số đo cũ khi kéo nhanh)
│   ├── useTraining.ts        # luyện tập: đối phương (đáp án puzzle sau 0,5 s / Stockfish Lite 1 luồng), đồng hồ, xem đáp án
│   ├── useGameAnalysis.ts    # cả ván: EnginePool riêng cho mỗi lần phân tích (MultiPV 2), giữ live trong lúc chạy
│   └── useEngineAnalysis.ts  # live vị trí đang xem (10 s / depth 30); chưa có kết quả thì dùng eval của batch
├── components/
│   ├── GameSource.tsx  # tab chess.com | Dán PGN
│   ├── ChessComImport.tsx # tìm username, lọc thể loại, danh sách ván, tải thêm
│   ├── GameReview.tsx  # cột trái + giữa của một ván; phần "Phân tích" render vào cột phải qua portal (analysisSlot). App đổi `key` để reset
│   ├── Board.tsx       # react-chessboard v5: kéo/bấm để đi quân, chọn quân phong cấp (không tự phong Hậu), huy hiệu nhãn ở ô đích, mũi tên
│   ├── PlayerBar.tsx, AssessmentBar.tsx (thanh đánh giá ngang + "Trắng chiếu hết sau N nước"), MoveStrip.tsx (dải nước ngang)
│   ├── EngineLines.tsx # EngineStatusRow (cột trái: công tắc, depth) + EngineLines (cột phải: eval + biến chính)
│   ├── ReviewSummary.tsx # 2 người chơi, Accuracy/Rating/chess.com, bảng nhãn 2 bên, thời gian TB, chọn độ sâu
│   ├── EvalChart.tsx   # recharts (tải lười): tab Đánh giá (win%) | Thời gian (giây/nước); bấm để nhảy
│   ├── MoveFeedback.tsx  # nhãn nước, nước tốt nhất, "Bỏ lỡ chiếu hết sau N nước", giải thích AI
│   ├── VariationBar.tsx  # biến phụ đang thử + "Về ván chính"
│   ├── TrainingMode.tsx  # màn luyện tập 3 cột (chọn bài, đồng hồ + bàn cờ, kết quả + thống kê)
│   ├── TrainingBoard.tsx # bàn cờ luyện tập: đi quân / premove nhiều nước (ô đỏ), chuột phải hủy
│   ├── PromotionPicker.tsx # chọn quân phong cấp, dùng chung cho Board và TrainingBoard
│   ├── MoveBadge.tsx, GameHeader.tsx, PgnInput.tsx
└── App.tsx             # tab chế độ Review ván | Luyện chiếu hết (review chỉ bị ẩn, không unmount); bố cục 3 cột; giữ cột phải (tab Phân tích | Chọn ván) để khung chọn ván không mount lại
scripts/copy-stockfish.mjs  # predev/prebuild: copy engine từ node_modules → public/stockfish/
vercel.json                 # header COOP/COEP + cache cho /stockfish/*
docs/scoring.md             # công thức, ngưỡng, quy tắc Brilliant/Great, chỗ khác lichess

scripts/build-openings.mjs  # tạo lại src/openings/openings.json
scripts/build-puzzles.mjs   # tạo lại src/training/puzzles.json từ lichess_db_puzzle.csv.zst (dạng pzstd: tự bỏ skippable frame)
README.md, LICENSE (GPL-3.0), docs/screenshots/
public/stockfish/ # file stockfish .js + .wasm, copy tự động từ node_modules lúc build (không commit)
```
**Quy ước vị trí**: `ply ∈ [0, plies.length]`, trong đó 0 là thế cờ ban đầu, k là thế cờ sau nước `plies[k-1]`. `evals[k]` là eval của vị trí k; nước `plies[i]` được chấm bằng `evals[i]` và `evals[i+1]`.
**Quy ước engine**: chỉ truy cập qua `getEngineManager()`. `EngineInfo.score` từ engine luôn theo góc nhìn Trắng. `mate N` tính theo số nước của bên chiếu hết, giống UCI/lichess. Vị trí đã kết thúc thì không gọi engine mà dùng `terminalScore`. Phân tích cả ván chạy trên `EnginePool` (worker riêng, mặc định 5×Full 1 luồng; số engine theo `poolSize`: nhân CPU và RAM). Trong lúc đó gọi `holdLive()` để engine live nhường CPU; mọi nhánh thoát (kể cả lỗi/hủy) phải `terminate()` pool (giải phóng ~170 MB/engine) và gọi hàm thả live. Lý do chọn pool: đo trên ván 108 vị trí, 5×Full 1 luồng ≈ 16–19 s với chất lượng ngang Full 11 luồng 1 s/vị trí (≈ 72 s).
**Quy ước luyện tập**: puzzle lichess có FEN là thế cờ *trước* nước của đối phương (`moves[0]`), người giải là bên còn lại. Premove chỉ kiểm tra hình học trên bàn ảo; lúc tới lượt luôn kiểm tra lại bằng luật đầy đủ (chess.js), sai thì hủy cả hàng đợi, nên không bao giờ đi nước phạm luật. Đồng hồ chỉ chạy trong lượt người chơi. Engine phòng thủ là `EnginePool('lite-single', maxEngines 1)`, terminate khi rời màn luyện tập.
Luồng dữ liệu: `PGN → chess/ → GameModel → engine/ (eval từng vị trí) → analysis/ (phân loại + accuracy) → components/`

## Logic chấm điểm (src/analysis)
- **Quy ước dấu**: Stockfish báo eval theo góc nhìn **bên đang tới lượt**. Khi lưu, luôn đổi về **góc nhìn quân Trắng**. Khi chấm một nước, đổi sang góc nhìn **người vừa đi**. Đây là chỗ hay sai nhất.
- **Mate**: `mate N` quy ra win% = 100 (bên được chiếu hết thắng) hoặc 0. Không nhét số cp giả vào công thức.
- **Win% (lichess)**: `win = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`, cp được kẹp trong [-1000, 1000]
- **Accuracy từng nước (lichess)**: `acc = 103.1668 * exp(-0.04354 * (winBefore - winAfter)) - 3.1669 + 1` ("uncertainty bonus" của lichess), kẹp trong [0, 100]; bằng 100 nếu không tụt (win% theo góc nhìn người đi)
- **Accuracy cả ván**: theo lichess, là trung bình của (trung bình có trọng số theo độ biến động) và (trung bình điều hòa, mẫu kẹp ≥ 1). Chi tiết ghi ở `docs/scoring.md`
- **Phân loại theo chess.com** (người dùng yêu cầu chấm "hoàn toàn theo chess.com"; định nghĩa lấy từ trang hỗ trợ chính thức của chess.com, chi tiết và các chỗ chỉ làm gần đúng ở `docs/scoring.md`). win% của người đi được dùng làm "expected points" (0.02 = 2 điểm). Mọi ngưỡng đặt trong `src/analysis/thresholds.ts`, không hard-code rải rác:

  | Nhãn | Điều kiện |
  |---|---|
  | Book | các nước liên tiếp từ đầu ván có vị trí nằm trong dữ liệu khai cuộc; luôn ghi đè nhãn khác như chess.com, không đổi Accuracy |
  | Brilliant | thí quân, drop ≤ 2, winAfter ≥ 50, nước tốt nhất *khác* nước đã đi có win% < 97 |
  | Great | nước tốt nhất, biến 2 rơi xuống vùng kết quả tệ hơn (thua < 33 ≤ cân bằng ≤ 67 < thắng); không tính chiếu hết, ăn lại quân ngay |
  | Best | trùng nước top-1 của engine |
  | Miss | đối phương vừa đi Mistake/Miss/Blunder, nước này không tốt nhất, drop > 5 và làm rơi vùng kết quả; ghi đè các nhãn lỗi |
  | Excellent / Good / Inaccuracy / Mistake | drop ≤ 2 / ≤ 5 / ≤ 10 / ≤ 20 |
  | Blunder | drop > 20 |

  Chess.com **không công bố**: công thức expected points theo rating, ranh giới thắng/thua theo rating, mức nới cho người mới, công thức Accuracy (CAPS). Đừng tự "đoán" thêm; muốn chỉnh thì sửa `thresholds.ts` và ghi lại trong `docs/scoring.md`.
- **Best**: so `ply.uci` với `bestMove` của eval batch tại `fenBefore` (không dùng `pv[0]` của live).

## Nguồn ván (src/api)
- App dành cho **một người dùng**: mở app là tự tải ván chess.com của `DEFAULT_CHESSCOM_USERNAME` (`src/config.ts`, hiện là `konanlee`). Vẫn tìm được username khác, nhưng không lưu lại.
- **chess.com**: API công khai, không cần đăng nhập. `GET api.chess.com/pub/player/{user}/games/archives` → danh sách URL theo tháng (cũ → mới), mỗi tháng `{ games: [...] }`.
  - CORS chạy được dưới COEP require-corp (đã kiểm tra trên Chrome). curl bị Cloudflare chặn, nên khi kiểm tra API thì dùng trình duyệt.
  - Gọi **tuần tự**, không gọi song song (chess.com khuyến nghị). 404 nghĩa là không có người chơi, 429 là bị giới hạn tần suất.
  - Chỉ review ván `rules === 'chess'` (bỏ chess960/biến thể). PGN có comment `[%clk]`, `parsePgn` bỏ qua được.
  - Không dùng ảnh avatar của chess.com: ảnh khác origin không có CORP sẽ bị COEP chặn.
- **lichess**: `/api/games/user/{user}` trả 404 khi thử (10/2026), dù `/api/user/{user}` vẫn 200. Chưa tích hợp. Nếu làm, thêm loader cùng dạng `ChessComLoader`.

## Quy ước code
- TypeScript strict, không dùng `any`. Type dùng chung đặt trong `src/types.ts` hoặc cạnh module.
- `src/analysis` và `src/chess` là **pure function**: không import React, không gọi Worker. Mọi hàm ở đây phải có unit test.
- Engine chỉ được truy cập qua `src/engine`. Component không gửi lệnh UCI trực tiếp.
- Mỗi lần chỉ phân tích một vị trí (hàng đợi tuần tự), và phải có cách hủy khi người dùng đổi ván.
- Component là function component + hooks. Logic không nằm trong JSX.
- Tên file: component `PascalCase.tsx`, còn lại `camelCase.ts`.

## Giải thích bằng AI
- Gọi Claude API qua `@anthropic-ai/sdk` (tải lười), model `claude-opus-5-5`, effort `medium`, stream. Bật fallback phía server (`fallbacks: 'default'` + beta `server-side-fallback-2026-07-01`) và xử lý `stop_reason === 'refusal'`.
- Gọi thẳng từ trình duyệt (`dangerouslyAllowBrowser`) bằng API key **của người dùng**, vì không có backend. Key không bao giờ được hard-code, log hay đưa vào URL.
- **AI chỉ diễn giải, không tự tính cờ.** Prompt luôn kèm FEN, nước đã đi, nước engine đề xuất, PV (biến chính) và eval của Stockfish.
- Không commit API key. Key chỉ đến từ ô nhập của người dùng. **Không** đọc từ `.env`/`VITE_*`, vì biến `VITE_*` bị nhúng vào bundle công khai.
- AI chỉ được gửi dữ liệu engine (`src/ai/explainPrompt.ts`). Câu trả lời render dạng text thuần (không markdown, không `dangerouslySetInnerHTML`).
- CSP (`vite.config.ts` → `CONTENT_SECURITY_POLICY`, chép y hệt sang `vercel.json`; `deploy.test.ts` kiểm tra 2 bản khớp nhau): chỉ cho `connect-src` tới api.chess.com và api.anthropic.com. Thêm API mới thì phải sửa cả hai, rồi kiểm tra bằng `npm run build && npx vite preview`. Dev server không có CSP.

## Lộ trình (xong giai đoạn nào thì commit giai đoạn đó)
- [x] **GĐ1**: Bàn cờ + dán PGN + danh sách nước + tới/lui (nút và phím ←/→)
- [x] **GĐ2**: Tích hợp Stockfish (Worker), eval bar
- [x] **GĐ3**: Phân loại nước + Accuracy + biểu đồ eval (recharts) + hiện nước engine đề xuất
- [x] **GĐ4**: Kéo ván từ chess.com theo username (`api.chess.com/pub/player/{username}/games/archives`), có thể thêm lichess
- [x] **GĐ5**: Nhận diện khai cuộc (Book), giải thích bằng AI, làm đẹp giao diện

## Cách làm việc
- Mỗi giai đoạn: dùng **Plan mode** lập kế hoạch trước → code → `npm test` + `npm run build` → commit.
- Commit nhỏ, message dạng Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`...).
- Khi sửa `src/analysis` hoặc `src/engine`, gọi subagent `chess-logic-reviewer` để kiểm tra.
