local luaseed = pd.Class:new():register("luaseed")

-- ─────────────────────────────────────
function luaseed:initialize(name, args)
	self.inlets = 1
	self.outlets = 0
	return true
end

-- ─────────────────────────────────────
function luaseed:in_1_float(f)
	math.randomseed(f)
end
-- ─────────────────────────────────────
function luaseed:in_1_reload()
	self:dofilex(self._scriptname)
	self:initialize()
	pd.post("ok")
end
