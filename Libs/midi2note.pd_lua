local m2n_dddd = pd.Class:new():register("midi2note")

local NOTE_NAMES = {
	"C", "C#", "D", "D#", "E", "F",
	"F#", "G", "G#", "A", "A#", "B"
}

-- ─────────────────────────────────────
local function midi_to_note(midi)
	midi = math.floor(tonumber(midi) or 0)

	if midi < 0 or midi > 127 then
		return "invalid"
	end

	local note = NOTE_NAMES[(midi % 12) + 1]
	local octave = math.floor(midi / 12) - 1

	return string.format("%s%d", note, octave)
end

-- ─────────────────────────────────────
function m2n_dddd:initialize(_, args)
	self.inlets = 1
	self.outlets = 1
	return true
end

-- ─────────────────────────────────────
function m2n_dddd:in_1_list(atoms)
	local out = {}

	for i, v in ipairs(atoms) do
		out[i] = midi_to_note(v)
	end

	self:outlet(1, "list", out)
end

-- ─────────────────────────────────────
function m2n_dddd:in_1_float(f)
	local converted = midi_to_note(f)
	self:outlet(1, "symbol", {converted})
end

-- ─────────────────────────────────────
function m2n_dddd:in_1_reload()
	self:dofilex(self._scriptname)
	self:initialize()
end
