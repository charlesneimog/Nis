local listshuffle = pd.Class:new():register("x.list-shuffle")

-- ─────────────────────────────────────
function listshuffle:initialize(name, args)
	self.inlets = 1
	self.outlets = 1
	return true
end

-- ─────────────────────────────────────
function listshuffle:in_1_list(args)
	local n = #args
	for i = n, 2, -1 do
		local j = math.random(i)
		args[i], args[j] = args[j], args[i]
	end
	self:outlet(1, "list", args)
end
-- ─────────────────────────────────────
function listshuffle:in_1_reload()
	self:dofilex(self._scriptname)
	self:initialize()
	pd.post("ok")
end
