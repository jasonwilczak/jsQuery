define(['searchMaker'],function(searchMaker){
  describe("SearchMaker inititalize", function() {
    it("returns true when complete", function() {
      expect(searchMaker.Init()).toBe(true);
    });
  });
})
